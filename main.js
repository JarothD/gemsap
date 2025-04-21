const url = require('url');
const path = require("path");
const http = require('http');
const { spawn } = require('child_process');
const { app, BrowserWindow, session, ipcMain, screen } = require("electron");
const isDev = require("electron-is-dev");

let mainWindow;
let server; // Referencia al servidor
let serverProcess; // Referencia al proceso del servidor en desarrollo

// Función para verificar si un puerto está disponible
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = http.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => {
        tester.once('close', () => resolve(true));
        tester.close();
      })
      .listen(port);
  });
}

// Función para esperar a que el servidor esté listo
async function waitForServer(port, maxRetries = 30, retryInterval = 500) {
  console.log(`[Electron] Esperando a que el servidor esté disponible en el puerto ${port}...`);
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      // Usar http.request en lugar de fetch para mayor compatibilidad
      await new Promise((resolve, reject) => {
        const req = http.request({
          hostname: 'localhost',
          port: port,
          path: '/health',
          method: 'GET',
          timeout: 1000
        }, (res) => {
          if (res.statusCode === 200) {
            // Leer el cuerpo de la respuesta para liberar la conexión
            let data = '';
            res.on('data', (chunk) => {
              data += chunk;
            });
            res.on('end', () => {
              console.log(`[Electron] Servidor disponible en el puerto ${port}`);
              resolve(true);
            });
          } else {
            reject(new Error(`Status code: ${res.statusCode}`));
          }
        });
        
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
        
        req.end();
      });
      
      return true;
    } catch (err) {
      // Ignorar errores - simplemente significa que el servidor no está listo
      retries++;
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }
  }
  
  console.warn(`[Electron] Tiempo de espera agotado para el servidor en el puerto ${port}`);
  return false;
}

// Función para iniciar el servidor
async function startServer() {
  console.log('[Electron] Iniciando el servidor...');
  
  // Verificar si los puertos están disponibles
  const webSocketPort = 3002;
  const httpPort = 9001;
  
  const webSocketAvailable = await isPortAvailable(webSocketPort);
  const httpAvailable = await isPortAvailable(httpPort);
  
  if (!webSocketAvailable || !httpAvailable) {
    console.log('[Electron] Detectados servidores ya en ejecución, intentando limpiar...');
    
    // Intentar cerrar servidores existentes
    if (process.platform === 'win32') {
      await new Promise((resolve) => {
        spawn('cmd', ['/c', 
          'FOR /F "tokens=5" %P IN (\'netstat -a -n -o ^| findstr :9001 :3002\') DO TaskKill /PID %P /F /T'
        ], { shell: true }).on('close', resolve);
      });
    } else {
      await new Promise((resolve) => {
        spawn('bash', ['-c', 
          'lsof -i :9001,3002 -t | xargs kill -9 2>/dev/null || true'
        ], { shell: true }).on('close', resolve);
      });
    }
    
    // Esperar un momento para que los puertos se liberen
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  if (isDev) {
    // En desarrollo, iniciar el servidor como proceso separado
    console.log('[Electron] Iniciando servidor en modo desarrollo...');
    
    const serverPath = path.join(__dirname, 'server', 'server.js');
    const nodeExecutable = process.execPath;
    const nodeModulesPath = path.join(__dirname, 'node_modules');
    
    // Usar spawn para iniciar el servidor
    serverProcess = spawn(
      process.platform === 'win32' ? 'node' : 'node',
      [serverPath],
      {
        stdio: 'pipe',
        env: {
          ...process.env,
          NODE_PATH: nodeModulesPath,
          ELECTRON_RUN_AS_NODE: '1'
        }
      }
    );
    
    // Pipe de salida del servidor
    serverProcess.stdout.on('data', (data) => {
      console.log(`[Server] ${data.toString().trim()}`);
    });
    
    serverProcess.stderr.on('data', (data) => {
      console.error(`[Server Error] ${data.toString().trim()}`);
    });
    
    serverProcess.on('close', (code) => {
      console.log(`[Electron] El proceso del servidor se cerró con código ${code}`);
    });
    
    // Esperar a que el servidor esté disponible
    await waitForServer(httpPort);
    console.log('[Electron] Servidor iniciado correctamente en modo desarrollo');
  } else {
    // En producción, cargar el servidor directamente
    console.log('[Electron] Cargando servidor en modo producción...');
    try {
      server = require(path.join(__dirname, 'build-server', 'server.js'));
      console.log('[Electron] Servidor cargado correctamente en modo producción');
    } catch (err) {
      console.error('[Electron] Error al cargar el servidor:', err);
    }
  }
}

async function createWindow() {
  // Iniciar el servidor antes de crear la ventana
  await startServer();
  
  // Set custom cache path before creating window
  const userDataPath = path.join(app.getPath('temp'), 'electron-cache');
  app.setPath('userData', userDataPath);

  // Create cache directory if it doesn't exist
  const fs = require('fs');
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  // Limpiar caché antes de iniciar
  const ses = session.defaultSession;
  await ses.clearCache();
  
  // Configurar opciones de sesión
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });

  // Obtener el display primario y sus dimensiones antes de crear la ventana
  const primaryDisplay = screen.getPrimaryDisplay();
  const { workArea } = primaryDisplay;

  // Calcular dimensiones proporcionales
  const width = Math.round(workArea.width * 0.5); // 50% del ancho de la pantalla
  const height = Math.round(workArea.height * 0.3); // 30% del alto de la pantalla

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: Math.round(workArea.width * 0.3), 
    minHeight: Math.round(workArea.height * 0.3), 
    maxWidth: Math.round(workArea.width * 0.5), 
    maxHeight: Math.round(workArea.height * 0.9),
    icon: path.join(__dirname, "public/favicon.ico"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      preload: path.join(__dirname, "preload.js"),
      enableRemoteModule: false,
      // Configurar seguridad para desarrollo
      ...(isDev && {
        allowRunningInsecureContent: false, // Mantener seguridad
        webSecurity: true // Mantener seguridad
      })
    }
  });

  // Calcular la posición para la esquina inferior derecha
  const windowBounds = mainWindow.getBounds();
  const x = workArea.x + workArea.width - windowBounds.width;
  const y = workArea.y + workArea.height - windowBounds.height;

  // Posicionar y mostrar la ventana
  mainWindow.setPosition(x, y);
  mainWindow.show();

  // Deshabilitar el caché
  mainWindow.webContents.session.clearCache();

  // Enviar el estado del servidor a la ventana una vez que esté lista
  let serverStatusSent = false;
  
  mainWindow.webContents.on('did-finish-load', () => {
    if (!serverStatusSent) {
      serverStatusSent = true;
      mainWindow.webContents.send('server-status', { 
        running: true, 
        ports: {
          http: 9001,
          ws: 3002
        }
      });
      console.log('[Electron] Estado del servidor enviado al render process');
    }
  });

  // Cargar la URL apropiada
  mainWindow.loadURL(
    isDev
      ? "http://localhost:3000"
      : url.format({
          pathname: path.join(__dirname, 'build/index.html'),
          protocol: 'file:',
          slashes: true,
        })
  );

  mainWindow.removeMenu();

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Manejar errores de caché
  mainWindow.webContents.on('crashed', (event) => {
    console.log('Window crashed:', event);
  });

  mainWindow.webContents.on('console-message', (event, level, message) => {
    if (message.includes('Unable to create cache')) {
      // Ignorar errores específicos de caché
      return;
    }
    console.log('Console message:', message);
  });

  // Configurar CSP apropiado
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self';" +
          "script-src 'self' 'unsafe-inline' http://localhost:*;" +
          "style-src 'self' 'unsafe-inline';" +
          "img-src 'self' https://gemsap.com data:;" +
          "connect-src 'self' ws://localhost:* http://localhost:*;"
        ]
      }
    });
  });
}

// Agregar manejador de señales de terminación
async function handleAppTermination() {
  console.log('[Electron] Iniciando cierre de la aplicación...');
  
  // Cerrar el proceso del servidor en desarrollo
  if (isDev && serverProcess) {
    console.log('[Electron] Terminando proceso del servidor en desarrollo...');
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', serverProcess.pid, '/f', '/t'], { detached: true });
    } else {
      serverProcess.kill('SIGTERM');
    }
  }
  
  // Cerrar servidor en producción
  if (!isDev && server && typeof server.closeAllServers === 'function') {
    console.log('[Electron] Cerrando servidor en producción...');
    try {
      await server.closeAllServers();
    } catch (err) {
      console.error('[Electron] Error al cerrar servidores:', err);
    }
  }
  
  // Limpieza adicional para asegurarse de que todos los puertos se liberen
  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      spawn('cmd', ['/c', 
        'FOR /F "tokens=5" %P IN (\'netstat -a -n -o ^| findstr :9001 :3002\') DO TaskKill /PID %P /F /T'
      ], { shell: true, detached: true }).on('close', resolve);
    });
  } else {
    await new Promise((resolve) => {
      spawn('bash', ['-c', 
        'lsof -i :9001,3002 -t | xargs kill -9 2>/dev/null || true'
      ], { shell: true }).on('close', resolve);
    });
  }
  
  console.log('[Electron] Limpieza completada');
}

app.on("window-all-closed", async () => {
  if (process.platform !== "darwin") {
    await handleAppTermination();
    app.quit();
  }
});

// Agregar manejador para cierre forzado
app.on("before-quit", async (event) => {
  event.preventDefault();
  await handleAppTermination();
  app.exit();
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.whenReady().then(createWindow);

// WebSocket connection tracking across renderer processes
const wsConnections = new Map(); // Track WebSocket connections by window ID

// Handle WebSocket initialization from renderer process
ipcMain.on('ws-initialized', (event, data) => {
  const { windowId, timestamp } = data;
  const webContentsId = event.sender.id;
  
  // Store connection info
  wsConnections.set(windowId, {
    webContentsId,
    timestamp,
    isActive: true
  });
  
  console.log(`[Electron] WebSocket initialized in renderer process (window: ${windowId}, webContents: ${webContentsId})`);
  
  // If this isn't the first connection, notify the renderer to make it passive
  const connections = Array.from(wsConnections.values());
  if (connections.length > 1) {
    // Sort by timestamp (oldest first) to find primary connection
    connections.sort((a, b) => a.timestamp - b.timestamp);
    const primaryConnection = connections[0];
    
    // If this is not the primary connection, tell it to close
    if (primaryConnection.webContentsId !== webContentsId) {
      event.reply('ws-make-passive', { 
        reason: 'not-primary',
        primaryWindowId: Array.from(wsConnections.entries())
          .find(([_, info]) => info.webContentsId === primaryConnection.webContentsId)?.[0]
      });
    }
  }
});

// Handle WebSocket disconnection notification
ipcMain.on('ws-disconnected', (event, data) => {
  const { windowId } = data;
  if (wsConnections.has(windowId)) {
    console.log(`[Electron] WebSocket disconnected in renderer process (window: ${windowId})`);
    wsConnections.delete(windowId);
    
    // If there are other connections, activate the oldest one
    if (wsConnections.size > 0) {
      const connections = Array.from(wsConnections.entries());
      connections.sort(([_, a], [__, b]) => a.timestamp - b.timestamp);
      const [oldestWindowId, oldestConnection] = connections[0];
      
      // Find the webContents by ID
      const webContents = BrowserWindow.getAllWebContents()
        .find(wc => wc.id === oldestConnection.webContentsId);
      
      if (webContents) {
        console.log(`[Electron] Activating WebSocket in window ${oldestWindowId}`);
        webContents.send('ws-activate', { reason: 'primary-disconnected' });
      }
    }
  }
});

// Handle reconnection request from renderer process
ipcMain.on('ws-reconnect-request', (event, data) => {
  const { windowId } = data;
  
  // Notify all other WebSocket instances to reconnect
  BrowserWindow.getAllWebContents().forEach(webContents => {
    if (webContents.id !== event.sender.id) {
      webContents.send('ws-reconnect', { 
        requestingWindowId: windowId,
        timestamp: Date.now()
      });
    }
  });
});

// Objeto para rastrear a qué ventanas ya se les ha enviado el estado del servidor
const windowsNotifiedOfServerStatus = new Set();

// Manejar solicitudes para iniciar el servidor (para compatibilidad)
ipcMain.on('startServer', (event) => {
  const webContentsId = event.sender.id;
  
  // Si ya se notificó a esta ventana, no volver a enviar
  if (windowsNotifiedOfServerStatus.has(webContentsId)) {
    return;
  }
  
  // Marcar como notificada
  windowsNotifiedOfServerStatus.add(webContentsId);
  
  // Enviar estado del servidor
  event.reply('server-status', { 
    running: true,
    ports: {
      http: 9001,
      ws: 3002
    }
  });
  
  console.log(`[Electron] Estado del servidor enviado a webContents ${webContentsId} (startServer)`);
});

ipcMain.on('start-server', (event) => {
  const webContentsId = event.sender.id;
  
  // Si ya se notificó a esta ventana, no volver a enviar
  if (windowsNotifiedOfServerStatus.has(webContentsId)) {
    return;
  }
  
  // Marcar como notificada
  windowsNotifiedOfServerStatus.add(webContentsId);
  
  // Enviar estado del servidor
  event.reply('server-status', { 
    running: true,
    ports: {
      http: 9001,
      ws: 3002
    }
  });
  
  console.log(`[Electron] Estado del servidor enviado a webContents ${webContentsId} (start-server)`);
});

// Limpiar referencias cuando se cierra una ventana
app.on('browser-window-closed', (_, window) => {
  if (window && window.webContents) {
    windowsNotifiedOfServerStatus.delete(window.webContents.id);
  }
});
