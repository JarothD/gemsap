const url = require('url');
const path = require("path");

const { app, BrowserWindow, session, ipcMain } = require("electron");
const isDev = require("electron-is-dev");

let mainWindow;
let server; // Referencia al servidor

async function createWindow() {
  // Set custom cache path before creating window
  const userDataPath = path.join(app.getPath('temp'), 'electron-cache');
  app.setPath('userData', userDataPath);

  // Create cache directory if it doesn't exist
  const fs = require('fs');
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  if (!isDev) {
    // Inicia el servidor y guarda la referencia
    server = require(path.join(__dirname, 'server/server.js'));
  }

  // Limpiar caché antes de iniciar
  const ses = session.defaultSession;
  await ses.clearCache();
  
  // Configurar opciones de sesión
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });

  mainWindow = new BrowserWindow({
    width: 800,
    height: 680,
    minHeight: 800,
    minWidth: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      preload: path.join(__dirname, "preload.js"),
      enableRemoteModule: false,
      // Only disable security features in development
      ...(isDev && {
        webSecurity: false,
        allowRunningInsecureContent: true
      })
    }
  });

  // Deshabilitar el caché
  mainWindow.webContents.session.clearCache();

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

  // Agregar CSP seguro
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [isDev ? 
          "default-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:8097; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' https://gemsap.com data:; " +
          "connect-src 'self' ws://localhost:* http://localhost:*;"
          :
          "default-src 'self'; " +
          "script-src 'self'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' https://gemsap.com; " +
          "connect-src 'self' ws://localhost:3002 http://localhost:9001;"
        ]
      }
    });
  });
}

// Agregar manejador de señales de terminación
function handleAppTermination() {
  return new Promise(async (resolve) => {
    if (!isDev && server && server.closeAllServers) {
      await server.closeAllServers();
    }
    
    if (isDev) {
      // En desarrollo, intentar limpiar los puertos
      require('child_process').exec(
        'FOR /F "tokens=5" %P IN (\'netstat -a -n -o ^| findstr :9001 :3002\') DO TaskKill /PID %P /F /T',
        () => resolve()
      );
    } else {
      resolve();
    }
  });
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

app.on("ready", createWindow);

// Agregar manejadores de IPC
ipcMain.on('startServer', (event) => {
  if (isDev) {
    const { spawn } = require('child_process');
    const serverProcess = spawn('npm', ['run', 'cors-server'], {
      shell: true,
      stdio: 'pipe'
    });

    serverProcess.stdout.on('data', (data) => {
      event.reply('serverStatus', data.toString());
    });

    serverProcess.stderr.on('data', (data) => {
      event.reply('serverStatus', `Error: ${data.toString()}`);
    });
  }
});

ipcMain.on('start-server', async (event) => {
  if (isDev) {
    const { spawn } = require('child_process');
    const serverProcess = spawn('yarn', ['server-start'], {
      shell: true,
      stdio: 'pipe'
    });

    serverProcess.stdout.on('data', (data) => {
      event.reply('server-status', { type: 'info', message: data.toString() });
    });

    serverProcess.stderr.on('data', (data) => {
      event.reply('server-status', { type: 'error', message: data.toString() });
    });

    // Store server process reference for cleanup
    app.on('before-quit', () => {
      serverProcess.kill();
    });
  }
});
