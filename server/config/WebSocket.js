const ws = require('ws');
const wsServer = new ws.Server({ port: '3002' });

// Crear un objeto para manejar el estado y métodos del WebSocket
const WebSocketManager = {
    activeSocket: null,
    
    send: function(data) {
        if (this.activeSocket && this.activeSocket.readyState === ws.OPEN) {
            this.activeSocket.send(data, (error) => {
                if (error) console.error('WebSocket send error:', error);
            });
        } else {
            console.warn('No active WebSocket connection to send data');
        }
    },

    setupConnection: function(socket) {
        console.log("Connection Established");

        // Si hay una conexión activa y es diferente a la nueva, cerrarla
        if (this.activeSocket && this.activeSocket !== socket && this.activeSocket.readyState === ws.OPEN) {
            console.log("Closing previous connection...");
            this.activeSocket.terminate(); // Usar terminate en lugar de close
        }

        this.activeSocket = socket;

        socket.on('error', (error) => {
            console.error('Socket error:', error);
        });

        socket.on('close', () => {
            console.log('Connection closed');
            if (this.activeSocket === socket) {
                this.activeSocket = null;
            }
        });
    }
};

// Configurar el servidor WebSocket
wsServer.on('connection', (socket) => {
    WebSocketManager.setupConnection(socket);
});

module.exports = WebSocketManager;