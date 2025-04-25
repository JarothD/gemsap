const url = require('url');
const path = require("path");
const http = require('http');
const { spawn } = require('child_process');
const { app, BrowserWindow, session, ipcMain, screen, shell } = require("electron");
const isDev = require("electron-is-dev");

// Configurar metadatos de la aplicación
app.setAppUserModelId("com.electron-react-node");
app.setName("GEMSAP Certificados");

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
          path: port === 3000 ? '/' : '/health',
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
    const nodeModulesPath = path.join(__dirname, 'node_modules');
    
    // Usar nodemon en desarrollo para recarga automática
    serverProcess = spawn(
      process.platform === 'win32' ? 
        path.join(__dirname, 'node_modules', '.bin', 'nodemon.cmd') : 
        path.join(__dirname, 'node_modules', '.bin', 'nodemon'),
      [
        '-L',
        '--watch', 'server',
        '--ext', 'js,json',
        serverPath
      ],
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
  
  // Esperar a que el servidor de desarrollo react esté disponible
  if (isDev) {
    console.log('[Electron] Esperando a que el servidor de desarrollo React esté disponible...');
    await waitForServer(3000, 60, 1000); // 60 segundos de tiempo de espera, intervalos de 1 segundo
  }
  
  // Asegurarse que la aplicación tenga el ícono correcto en la barra de tareas de Windows
  if (process.platform === 'win32') {
    app.setAppUserModelId(app.name);
  }
  
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
    icon: path.join(__dirname, "assets/icon.ico"),
    title: "GEMSAP Certificados",
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
  const loadUrl = isDev
      ? "http://localhost:3000"
      : url.format({
          pathname: path.join(__dirname, 'build/index.html'),
          protocol: 'file:',
          slashes: true,
        });
  
  console.log(`[Electron] Cargando URL: ${loadUrl}`);
  
  // Agregar evento para diagnosticar errores de carga
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Electron] Error al cargar URL (${validatedURL}): ${errorDescription} (code: ${errorCode})`);
    
    // Si es error de conexión rehusada y estamos en desarrollo, esperamos y reintentamos
    if (errorCode === -102 && isDev && validatedURL.includes('localhost:3000')) {
      console.log('[Electron] Reintentando cargar la URL en 2 segundos...');
      setTimeout(() => {
        console.log('[Electron] Reintentando cargar URL:', loadUrl);
        mainWindow.loadURL(loadUrl);
      }, 2000);
    }
  });
  
  // Cargar URL con reintentos
  let retryCount = 0;
  const maxRetries = 5;
  
  function loadWithRetry() {
    console.log(`[Electron] Intento ${retryCount + 1}/${maxRetries} para cargar URL: ${loadUrl}`);
    
    mainWindow.loadURL(loadUrl)
      .catch(err => {
        console.error('[Electron] Error al cargar URL:', err);
        retryCount++;
        
        if (retryCount < maxRetries) {
          console.log(`[Electron] Reintentando en ${retryCount * 1000}ms...`);
          setTimeout(loadWithRetry, retryCount * 1000);
        } else {
          console.error('[Electron] Número máximo de reintentos alcanzado.');
          // Cargar una página de error
          mainWindow.loadURL(
            url.format({
              pathname: path.join(__dirname, 'error.html'),
              protocol: 'file:',
              slashes: true
            })
          ).catch(e => console.error('No se pudo cargar página de error:', e));
        }
      });
  }
  
  loadWithRetry();

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
          isDev 
            ? "default-src * 'self' 'unsafe-inline' 'unsafe-eval' data: blob: ws://localhost:* http://localhost:*;" 
            : "default-src 'self';" +
              "script-src 'self' 'unsafe-inline';" +
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

// Configurar acceso directo con el ícono correcto al instalar (Windows)
if (process.platform === 'win32' && !isDev) {
  const { join } = require('path');
  app.setUserTasks([
    {
      program: process.execPath,
      arguments: '',
      iconPath: join(__dirname, 'assets/icon.ico'),
      iconIndex: 0,
      title: 'GEMSAP Certificados',
      description: 'Abrir GEMSAP Certificados'
    }
  ]);
}

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

// Add IPC handler for opening directory
ipcMain.on('open-directory', (event, dirPath) => {
  console.log(`[Electron] Received request to open directory: ${dirPath}`);
  if (dirPath) {
    // Verificar si es un archivo o un directorio
    const fs = require('fs');
    const path = require('path');
    
    try {
      const stats = fs.statSync(dirPath);
      
      // Si es un archivo, usar showItemInFolder para mostrarlo seleccionado
      if (stats.isFile()) {
        console.log(`[Electron] Opening file with selection: ${dirPath}`);
        shell.showItemInFolder(dirPath);
        event.reply('open-directory-result', { success: true });
      } else {
        // Si es un directorio, usar openPath como antes
        shell.openPath(dirPath)
          .then(result => {
            if (result !== '') {
              console.error(`[Electron] Error opening directory: ${result}`);
              event.reply('open-directory-result', { success: false, error: result });
            } else {
              console.log(`[Electron] Successfully opened directory: ${dirPath}`);
              event.reply('open-directory-result', { success: true });
            }
          })
          .catch(err => {
            console.error('[Electron] Error opening directory:', err);
            event.reply('open-directory-result', { success: false, error: err.message });
          });
      }
    } catch (err) {
      // Si hay error al verificar el estado del archivo, intentar identificar si es un PDF
      console.warn(`[Electron] Error checking if path is file or directory: ${err.message}`);
      
      // Si es un error ENOENT (archivo no encontrado), y parece ser un archivo PDF
      // intentar extraer el directorio padre y abrirlo
      if (err.code === 'ENOENT' && typeof dirPath === 'string' && dirPath.toLowerCase().endsWith('.pdf')) {
        console.log('[Electron] Archivo PDF no encontrado, intentando abrir directorio padre');
        
        // Extraer el directorio padre
        const parentDir = path.dirname(dirPath);
        console.log(`[Electron] Directorio padre: ${parentDir}`);
        
        // Verificar si el directorio padre existe
        if (fs.existsSync(parentDir)) {
          console.log(`[Electron] El directorio padre existe, intentando abrirlo: ${parentDir}`);
          shell.openPath(parentDir)
            .then(result => {
              if (result !== '') {
                console.error(`[Electron] Error opening parent directory: ${result}`);
                event.reply('open-directory-result', { success: false, error: result });
              } else {
                console.log(`[Electron] Successfully opened parent directory: ${parentDir}`);
                event.reply('open-directory-result', { success: true });
              }
            })
            .catch(err => {
              console.error('[Electron] Error opening parent directory:', err);
              event.reply('open-directory-result', { success: false, error: err.message });
            });
          return;
        }
      }
      
      // Intentar con openPath genérico como último recurso
      shell.openPath(dirPath)
        .then(result => {
          if (result !== '') {
            console.error(`[Electron] Error opening path: ${result}`);
            event.reply('open-directory-result', { success: false, error: result });
          } else {
            console.log(`[Electron] Successfully opened path: ${dirPath}`);
            event.reply('open-directory-result', { success: true });
          }
        })
        .catch(err => {
          console.error('[Electron] Error opening path:', err);
          event.reply('open-directory-result', { success: false, error: err.message });
        });
    }
  } else {
    console.error('[Electron] Invalid directory path received');
    event.reply('open-directory-result', { success: false, error: 'Invalid path' });
  }
});

// Función para actualizar el caché de íconos en Windows (para menú de inicio)
async function refreshWindowsIconCache() {
  if (process.platform === 'win32') {
    try {
      const { execFile } = require('child_process');
      const fs = require('fs');
      console.log('[Electron] Intentando actualizar caché de íconos...');
      
      // Este comando obliga a Windows a reconstruir el caché de íconos
      await new Promise((resolve) => {
        execFile('ie4uinit.exe', ['-ClearIconCache'], (err) => {
          if (err) {
            console.warn('[Electron] Error al limpiar caché con ie4uinit:', err);
          } else {
            console.log('[Electron] Caché de íconos limpiado con ie4uinit');
          }
          resolve();
        });
      });
      
      // Método alternativo para Windows 10/11
      await new Promise((resolve) => {
        execFile('ie4uinit.exe', ['-show'], (err) => {
          if (err) {
            console.warn('[Electron] Error al actualizar caché con ie4uinit -show:', err);
          } else {
            console.log('[Electron] Caché de íconos actualizado con ie4uinit -show');
          }
          resolve();
        });
      });
      
      console.log('[Electron] Proceso de actualización de caché de íconos completado');
    } catch (err) {
      console.error('[Electron] Error al actualizar caché de íconos:', err);
    }
  }
}

// Ejecutar la actualización del caché de íconos al iniciar
app.whenReady().then(() => {
  setTimeout(refreshWindowsIconCache, 2000);
});
