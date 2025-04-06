const ws = require('ws');
const wsServer = new ws.Server({ port: '3002' });

global.send = null;
let activeSocket = null; // Mantiene la referencia al único cliente conectado

function setupConnection(socket) {
    console.log("Connection Established");

    // Si ya hay un cliente conectado, cerramos la conexión previa
    if (activeSocket && activeSocket.readyState === ws.OPEN) {
        console.log("Closing previous connection...");
        activeSocket.close();
    }

    activeSocket = socket; // Guardamos la nueva conexión

    global.send = (data) => {
        if (activeSocket && activeSocket.readyState === ws.OPEN) {
            activeSocket.send(data, (error) => {
                if (error) console.error(error);
            });
        } else {
            console.error("No active connection to send data.");
        }
    };

    socket.on('error', (error) => {
        console.error('Socket error:', error);
        attemptReconnect();
    });

    socket.on('close', () => {
        console.log('Connection closed');
        attemptReconnect();
    });
}

function attemptReconnect() {
    console.log('Attempting to reconnect...');
    setTimeout(() => {
        if (!activeSocket || activeSocket.readyState === ws.CLOSED) {
            console.log('Waiting for a new connection...');
        }
    }, 5000); // Reintenta después de 5 segundos
}

wsServer.on('connection', (socket) => {
    setupConnection(socket);
});

// Agregar método para cerrar el servidor WebSocket
const closeWebSocketServer = () => {
    if (wsServer) {
        wsServer.close(() => {
            console.log('WebSocket server closed');
        });
    }
};

module.exports = {
    send: global.send,
    closeWebSocketServer
};