const url = require('url');
const path = require("path");

const { app, BrowserWindow, session, ipcMain, screen } = require("electron");
const isDev = require("electron-is-dev");

let mainWindow;
let server; // Referencia al servidor
let serverProcess; // Add this at the top with other declarations

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

  // Obtener el display primario y sus dimensiones antes de crear la ventana
  const primaryDisplay = screen.getPrimaryDisplay();
  const { workArea } = primaryDisplay;

  // Calcular dimensiones proporcionales
  const width = Math.round(workArea.width * 0.5); // 40% del ancho de la pantalla
  const height = Math.round(workArea.height * 0.3); // 60% del alto de la pantalla

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: Math.round(workArea.width * 0.3), 
    minHeight: Math.round(workArea.height * 0.3), 
    maxWidth: Math.round(workArea.width * 0.5), 
    maxHeight: Math.round(workArea.height * 0.9),
    icon: path.join(__dirname, "public/favicon.ico"),
    //show: false, // Ocultamos la ventana inicialmente
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

  // Añadir manejador para el evento maximize
  /* mainWindow.on('maximize', () => {
    console.log('Evento maximize activado');
    const { workArea } = screen.getPrimaryDisplay();
    const bounds = mainWindow.getBounds();
    
    // Primero desmaximizamos la ventana
    mainWindow.unmaximize();
    
    // Calculamos las nuevas dimensiones
    const newBounds = {
      x: workArea.x + workArea.width - bounds.width,
      y: 0, // Mantenemos la ventana en la parte superior
      width: bounds.width,
      height: workArea.height // Usamos toda la altura disponible
    };
    
    console.log('Nuevas dimensiones a aplicar:', newBounds);
    
    // Aplicamos las nuevas dimensiones
    setTimeout(() => {
      mainWindow.setBounds(newBounds);
      console.log('Dimensiones finales:', mainWindow.getBounds());
    }, 100); // Pequeño retraso para asegurar que unmaximize se complete
  }); */

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
function handleAppTermination() {
  return new Promise(async (resolve) => {
    if (!isDev && server && server.closeAllServers) {
      await server.closeAllServers();
    }
    
    if (isDev) {
      if (process.platform === 'win32') {
        // Windows: usar TaskKill para terminar procesos
        require('child_process').exec(
          'FOR /F "tokens=5" %P IN (\'netstat -a -n -o ^| findstr :9001 :3002\') DO TaskKill /PID %P /F /T',
          () => resolve()
        );
      } else {
        // Linux/Mac: usar lsof y kill
        require('child_process').exec(
          'lsof -i :9001,3002 -t | xargs kill -9 2>/dev/null || true',
          () => resolve()
        );
      }
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

// Modificar el manejador de IPC para mejor manejo multiplataforma
ipcMain.on('start-server', async (event) => {
  if (isDev && !serverProcess) {
    const { spawn } = require('child_process');
    const command = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';
    
    serverProcess = spawn(command, ['server-start'], {
      shell: true,
      stdio: 'pipe'
    });

    serverProcess.stdout.on('data', (data) => {
      event.reply('server-status', { type: 'info', message: data.toString() });
    });

    serverProcess.stderr.on('data', (data) => {
      event.reply('server-status', { type: 'error', message: data.toString() });
    });

    // Add error handler
    serverProcess.on('error', (error) => {
      console.error('Server process error:', error);
      serverProcess = null;
    });

    // Add exit handler
    serverProcess.on('exit', (code) => {
      console.log('Server process exited with code:', code);
      serverProcess = null;
    });

    // Store server process reference for cleanup
    app.on('before-quit', () => {
      if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
      }
    });
  }
});
