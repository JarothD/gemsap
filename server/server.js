/* eslint-disable react-hooks/rules-of-hooks */

const http = require('http');

const express = require('express');
const cors = require('cors');
const libre = require('libreoffice-convert');

const { closeWebSocketServer } = require('./config/WebSocket');
const { checkGhostscript } = require('./config/Ghostscript');
const routes = require('./routes');
libre.convertAsync = require('util').promisify(libre.convert);
require('./config/WebSocket');

const Api = express();
const HTTP = http.Server(Api);

Api.use(cors());
Api.use(express.json({ extended: true }));
Api.use('/', routes);

// Manejo de excepciones no controladas
process.on('uncaughtException', (err) => {
  console.error(err);
  console.log("Node NOT Exiting...");
});

// Add error handling for uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    // Notify the main process
    if (global.send) {
        global.send(JSON.stringify({ type: 'error', message: err.message }));
    }
});

// Función para iniciar el servidor
async function startServer() {
  try {
    await checkGhostscript();
    
    // Verificar si el puerto está en uso
    const testServer = http.createServer();
    
    return new Promise((resolve, reject) => {
      testServer.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.log('Puerto 9001 en uso, intentando cerrar la instancia anterior...');
          // Intentar cerrar el proceso anterior
          require('child_process').exec(
            'FOR /F "tokens=5" %P IN (\'netstat -a -n -o ^| findstr :9001\') DO TaskKill /PID %P /F /T',
            (error, stdout, stderr) => {
              if (error) {
                console.error(`Error al cerrar el puerto: ${error}`);
                reject(error);
                return;
              }
              // Intentar iniciar el servidor nuevamente después de un breve retraso
              setTimeout(() => {
                HTTP.listen(9001, () => {
                  console.log("Servidor reiniciado en puerto 9001");
                  resolve();
                });
              }, 1000);
            }
          );
        } else {
          reject(err);
        }
      });

      testServer.listen(9001, () => {
        testServer.close(() => {
          HTTP.listen(9001, () => {
            console.log("listening on *:9001");
            resolve();
          });
        });
      });
    });
  } catch (error) {
    console.error("Error al iniciar el servidor:", error);
    process.exit(1);
  }
}

// Inicia el servidor
startServer();

// Agregar método para cerrar todos los servidores
const closeAllServers = () => {
    return new Promise((resolve) => {
        closeWebSocketServer();
        if (HTTP) {
            HTTP.close(() => {
                console.log('HTTP server closed');
                resolve();
            });
        } else {
            resolve();
        }
    });
};

// Add graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Received SIGTERM. Performing cleanup...');
    await closeAllServers();
    process.exit(0);
});

// Exporta el servidor para que pueda ser cerrado desde main.js
module.exports = {
    server: HTTP,
    closeAllServers
};

