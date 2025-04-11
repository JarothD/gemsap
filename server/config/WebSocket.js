const ws = require('ws');
const EventEmitter = require('events');

// Aumentar el límite de listeners
EventEmitter.defaultMaxListeners = 15;

const wsServer = new ws.Server({ 
    port: '3002',
    // Añadir configuración adicional para mejorar la estabilidad
    clientTracking: true,
    handleProtocols: true,
    perMessageDeflate: {
        zlibDeflateOptions: {
            chunkSize: 1024,
            memLevel: 7,
            level: 3
        },
        zlibInflateOptions: {
            chunkSize: 10 * 1024
        },
        clientNoContextTakeover: true,
        serverNoContextTakeover: true,
        serverMaxWindowBits: 10,
        concurrencyLimit: 10,
        threshold: 1024
    }
});

const WebSocketManager = {
    activeSocket: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    
    send: function(data) {
        try {
            if (this.activeSocket && this.activeSocket.readyState === ws.OPEN) {
                this.activeSocket.send(JSON.stringify(data), (error) => {
                    if (error) {
                        console.error('WebSocket send error:', error);
                        this.handleError(error);
                    }
                });
            } else {
                console.warn('No active WebSocket connection to send data');
                this.attemptReconnect();
            }
        } catch (error) {
            console.error('Error sending WebSocket message:', error);
            this.handleError(error);
        }
    },

    handleError: function(error) {
        console.error('WebSocket error occurred:', error);
        if (this.activeSocket) {
            this.activeSocket.terminate();
            this.activeSocket = null;
        }
        this.attemptReconnect();
    },

    attemptReconnect: function() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Intento de reconexión ${this.reconnectAttempts} de ${this.maxReconnectAttempts}`);
            // Implementar lógica de reconexión si es necesario
        } else {
            console.error('Se alcanzó el máximo número de intentos de reconexión');
            this.reconnectAttempts = 0;
        }
    },

    setupConnection: function(socket) {
        // Limpiamos listeners anteriores si existen
        if (this.activeSocket) {
            this.activeSocket.removeAllListeners();
        }
        
        console.log("Connection Established");
        this.reconnectAttempts = 0;

        if (this.activeSocket && this.activeSocket !== socket && this.activeSocket.readyState === ws.OPEN) {
            console.log("Closing previous connection...");
            this.activeSocket.terminate();
        }

        this.activeSocket = socket;

        // Configurar timeout para la conexión
        socket.isAlive = true;
        
        const listeners = {
            pong: () => socket.isAlive = true,
            error: (error) => {
                console.error('Socket error:', error);
                this.handleError(error);
            },
            close: (code, reason) => {
                console.log(`Connection closed with code ${code} and reason: ${reason}`);
                if (this.activeSocket === socket) {
                    this.activeSocket = null;
                    this.attemptReconnect();
                }
                socket.removeAllListeners();
            },
            message: (data) => {
                try {
                    const message = JSON.parse(data);
                    console.log('Received message:', message);
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            }
        };

        // Registrar listeners
        Object.entries(listeners).forEach(([event, handler]) => {
            socket.on(event, handler);
        });
    }
};

// Configurar el servidor WebSocket
wsServer.on('connection', (socket) => {
    WebSocketManager.setupConnection(socket);
});

// Implementar heartbeat para detectar conexiones muertas
const interval = setInterval(() => {
    wsServer.clients.forEach((socket) => {
        if (socket.isAlive === false) {
            return socket.terminate();
        }
        socket.isAlive = false;
        socket.ping(() => {});
    });
}, 30000);

wsServer.on('close', () => {
    clearInterval(interval);
});

process.on('SIGTERM', () => {
    wsServer.close(() => {
        console.log('WebSocket server closed');
        process.exit(0);
    });
});

module.exports = WebSocketManager;