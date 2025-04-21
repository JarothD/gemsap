const ws = require('ws');
const EventEmitter = require('events');

// Aumentar el límite de listeners
EventEmitter.defaultMaxListeners = 15;

const wsServer = new ws.Server({ 
    port: 3002,
    // Añadir configuración adicional para mejorar la estabilidad
    clientTracking: true,
    handleProtocols: true,
    // Add proper keepalive settings
    pingTimeout: 60000, // 60 seconds (longer than client's 30s check)
    pingInterval: 15000, // 15 seconds
    perMessageDeflate: {
        zlibDeflateOptions: {
            chunkSize: 1024,
            memLevel: 7,
            level: 3
        },
        zlibInflateOptions: {
            chunkSize: 10 * 1024
        },
        // Reduced compression settings for better stability
        clientNoContextTakeover: false,
        serverNoContextTakeover: false,
        serverMaxWindowBits: 15,
        concurrencyLimit: 10,
        threshold: 1024
    }
});

// Utilidad para formatear objetos en consola
const formatLog = (data) => {
    if (typeof data === 'object' && data !== null) {
        try {
            if (data.type === 'Buffer' && Array.isArray(data.data)) {
                // Decodificar Buffer a string
                try {
                    const bufferData = Buffer.from(data.data);
                    return bufferData.toString('utf8');
                } catch (e) {
                    return JSON.stringify(data);
                }
            }
            return JSON.stringify(data);
        } catch (e) {
            return `[Objeto no serializable: ${e.message}]`;
        }
    }
    return String(data);
};

// Constantes para niveles de log
const LOG_LEVELS = {
    NONE: 0,      // No logging
    ERROR: 1,     // Only errors
    INFO: 2,      // Main connection events
    DEBUG: 3,     // All messages including heartbeats
    VERBOSE: 4    // Everything, including ping/pong
};

// Configuración de nivel de log (cambiar según necesidad)
const currentLogLevel = LOG_LEVELS.INFO;

// Función de log que respeta niveles
const log = (message, level = LOG_LEVELS.INFO) => {
    if (level <= currentLogLevel) {
        console.log(message);
    }
};

const WebSocketManager = {
    activeSockets: new Map(), // Map to store multiple active connections with IDs
    clientsByIP: new Map(), // Track clients by IP address
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    reconnectTimeout: null,
    lastSocketId: 0,
    
    // Send to all active connections
    broadcast: function(data) {
        try {
            const messageString = typeof data === 'string' ? data : JSON.stringify(data);
            let sentCount = 0;
            
            this.activeSockets.forEach((socket, id) => {
                if (socket && socket.readyState === ws.OPEN) {
                    socket.send(messageString, (error) => {
                        if (error) {
                            log(`WebSocket send error to ${id}: ${error}`, LOG_LEVELS.ERROR);
                            this.removeSocket(id);
                        }
                    });
                    sentCount++;
                }
            });
            
            if (sentCount === 0) {
                log('No active WebSocket connections to broadcast to', LOG_LEVELS.INFO);
            } else {
                // Solo log si no es un mensaje de mantenimiento
                const isMaintenanceMessage = data.type === 'heartbeat' || data.type === 'ping' || data.type === 'pong';
                if (!isMaintenanceMessage) {
                    log(`Broadcasted message to ${sentCount} connections`, LOG_LEVELS.INFO);
                } else {
                    log(`Broadcasted ${data.type} message to ${sentCount} connections`, LOG_LEVELS.DEBUG);
                }
            }
            
            return sentCount > 0;
        } catch (error) {
            log(`Error broadcasting WebSocket message: ${error}`, LOG_LEVELS.ERROR);
            return false;
        }
    },
    
    // Send to a specific connection
    send: function(data, socketId) {
        try {
            // If no specific socketId provided, broadcast to all
            if (socketId === undefined) {
                return this.broadcast(data);
            }
            
            const socket = this.activeSockets.get(socketId);
            
            if (socket && socket.readyState === ws.OPEN) {
                const messageString = typeof data === 'string' ? data : JSON.stringify(data);
                
                // Solo log mensajes importantes (no heartbeat/ping/pong)
                const isMaintenanceMessage = data.type === 'heartbeat' || data.type === 'ping' || data.type === 'pong';
                if (!isMaintenanceMessage) {
                    log(`Sending to socket ${socketId}: ${typeof data === 'object' ? formatLog(data) : data}`, LOG_LEVELS.INFO);
                } else {
                    log(`Sending ${data.type} to socket ${socketId}`, LOG_LEVELS.VERBOSE);
                }
                
                socket.send(messageString, (error) => {
                    if (error) {
                        log(`WebSocket send error to ${socketId}: ${error}`, LOG_LEVELS.ERROR);
                        this.removeSocket(socketId);
                    }
                });
                return true;
            } else {
                log(`No active WebSocket connection with ID ${socketId}`, LOG_LEVELS.INFO);
                this.removeSocket(socketId);
                return false;
            }
        } catch (error) {
            log(`Error sending WebSocket message: ${error}`, LOG_LEVELS.ERROR);
            return false;
        }
    },

    // Remove socket from active sockets map
    removeSocket: function(socketId) {
        if (this.activeSockets.has(socketId)) {
            const socket = this.activeSockets.get(socketId);
            
            // Remove from clientsByIP map
            if (socket.clientIp) {
                const clientSockets = this.clientsByIP.get(socket.clientIp) || [];
                const updatedSockets = clientSockets.filter(id => id !== socketId);
                
                if (updatedSockets.length === 0) {
                    this.clientsByIP.delete(socket.clientIp);
                } else {
                    this.clientsByIP.set(socket.clientIp, updatedSockets);
                }
            }
            
            if (socket.readyState === ws.OPEN) {
                try {
                    socket.terminate();
                } catch (e) {
                    log(`Error terminating socket ${socketId}: ${e}`, LOG_LEVELS.ERROR);
                }
            }
            this.activeSockets.delete(socketId);
            log(`Removed socket ${socketId}, remaining connections: ${this.activeSockets.size}`, LOG_LEVELS.INFO);
        }
    },

    // Generate a unique socket ID
    generateSocketId: function() {
        return `socket_${++this.lastSocketId}`;
    },

    handleError: function(error, socketId) {
        log(`WebSocket error occurred for socket ${socketId}: ${error}`, LOG_LEVELS.ERROR);
        this.removeSocket(socketId);
    },

    attemptReconnect: function() {
        // Clear any existing reconnect timeout
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            log(`Intento de reconexión ${this.reconnectAttempts} de ${this.maxReconnectAttempts}`, LOG_LEVELS.INFO);
            
            // Exponential backoff for reconnection
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
            this.reconnectTimeout = setTimeout(() => {
                this.reconnectTimeout = null;
            }, delay);
        } else {
            log('Se alcanzó el máximo número de intentos de reconexión', LOG_LEVELS.ERROR);
            this.reconnectAttempts = 0;
        }
    },

    // Check if client already has connections and clean up old ones
    handleDuplicateConnections: function(clientIp, newSocketId, windowId) {
        const existingSockets = this.clientsByIP.get(clientIp) || [];
        
        // If this client already has connections
        if (existingSockets.length > 0) {
            log(`Client ${clientIp} already has ${existingSockets.length} connections. Checking if any should be closed.`, LOG_LEVELS.DEBUG);
            
            // If we have a windowId, we may want to handle window-specific connections
            if (windowId) {
                // Check if there's already a connection from this window
                const socketFromSameWindow = existingSockets.find(id => {
                    const socket = this.activeSockets.get(id);
                    return socket && socket.windowId === windowId;
                });
                
                // If we found a connection from the same window, close it (replaced by this new one)
                if (socketFromSameWindow) {
                    log(`Closing duplicate connection ${socketFromSameWindow} from same window ${windowId}`, LOG_LEVELS.INFO);
                    this.removeSocket(socketFromSameWindow);
                }
            }
            
            // Get socket activity times
            const socketTimes = existingSockets.map(id => {
                const socket = this.activeSockets.get(id);
                return { 
                    id, 
                    lastActivity: socket ? socket.lastActivity || 0 : 0,
                    windowId: socket ? socket.windowId : null
                };
            });
            
            // Sort by last activity (oldest first)
            socketTimes.sort((a, b) => a.lastActivity - b.lastActivity);
            
            // Keep only the most recent connection per client (if we don't have a windowId)
            const maxConnectionsPerClient = 2; // Allow 2 for Electron apps (one per window)
            
            if (socketTimes.length > maxConnectionsPerClient - 1) { // -1 to account for new connection
                const socketsToRemove = socketTimes.slice(0, socketTimes.length - (maxConnectionsPerClient - 1));
                
                socketsToRemove.forEach(item => {
                    log(`Closing old connection ${item.id} from ${clientIp}${item.windowId ? ` (window: ${item.windowId})` : ''}`, LOG_LEVELS.INFO);
                    this.removeSocket(item.id);
                });
            }
        }
        
        // Update client's sockets list
        this.clientsByIP.set(clientIp, [...(existingSockets.filter(id => this.activeSockets.has(id))), newSocketId]);
    },

    // Handle message processing
    handleMessage: function(socketId, data) {
        try {
            const socket = this.activeSockets.get(socketId);
            if (!socket) return;
            
            socket.lastActivity = Date.now();
            
            let message;
            let rawMessage = data;
            
            // Si es un Buffer, intentar decodificarlo
            if (Buffer.isBuffer(data)) {
                try {
                    rawMessage = data.toString('utf8');
                } catch (e) {
                    log(`Error decodificando buffer: ${e.message}`, LOG_LEVELS.ERROR);
                }
            }
            
            // Intentar parsear el mensaje como JSON
            try {
                if (typeof rawMessage === 'string') {
                    message = JSON.parse(rawMessage);
                } else {
                    message = rawMessage;
                }
            } catch (e) {
                message = String(rawMessage);
            }
            
            // Handle ping messages immediately
            if (message && message.type === 'ping') {
                log(`Received ping from ${socketId}`, LOG_LEVELS.VERBOSE);
                
                // Send pong response immediately to prevent client timeout
                this.send({ 
                    type: 'pong', 
                    timestamp: message.timestamp,
                    serverTime: Date.now() 
                }, socketId);
                
                // Also send a heartbeat message to keep connection fresh
                setTimeout(() => {
                    if (this.activeSockets.has(socketId)) {
                        this.send({ 
                            type: 'heartbeat', 
                            time: Date.now() 
                        }, socketId);
                    }
                }, 1000);
                
                return;
            }
            
            // Log all non-heartbeat messages
            if (!message.type || (message.type !== 'heartbeat' && message.type !== 'ping' && message.type !== 'pong')) {
                log(`Received message from ${socketId}: ${formatLog(message)}`, LOG_LEVELS.INFO);
            } else {
                log(`Received ${message.type} from ${socketId}`, LOG_LEVELS.VERBOSE);
            }
        } catch (error) {
            log(`Error processing message from ${socketId}: ${error}`, LOG_LEVELS.ERROR);
        }
    },

    setupConnection: function(socket, req) {
        const socketId = this.generateSocketId();
        const clientIp = req.socket.remoteAddress;
        const windowId = socket.windowId || null;
        
        log(`New connection (${socketId}) from ${clientIp}${windowId ? `, window: ${windowId}` : ''}`, LOG_LEVELS.INFO);
        
        // Add to active sockets map
        this.activeSockets.set(socketId, socket);
        
        // Handle duplicate connections from the same client
        this.handleDuplicateConnections(clientIp, socketId, windowId);
        
        log(`Active connections: ${this.activeSockets.size}`, LOG_LEVELS.DEBUG);
        
        // Configurar timeout para la conexión
        socket.isAlive = true;
        socket.lastActivity = Date.now();
        socket.id = socketId;
        socket.clientIp = clientIp;
        socket.windowId = windowId;
        
        // This was causing crashes - ws library doesn't have setKeepAlive
        // Instead, we'll use the ping/pong protocol for keep-alive
        try {
            // Only try to set keepalive on the underlying socket if it exists
            if (socket._socket && typeof socket._socket.setKeepAlive === 'function') {
                socket._socket.setKeepAlive(true, 30000);
            }
        } catch (e) {
            log('Could not set keepalive on socket: ' + e.message, LOG_LEVELS.DEBUG);
        }
        
        const listeners = {
            pong: () => {
                socket.isAlive = true;
                socket.lastActivity = Date.now();
                log(`Received pong from client ${socketId}`, LOG_LEVELS.VERBOSE);
            },
            error: (error) => {
                log(`Socket error for ${socketId}: ${error}`, LOG_LEVELS.ERROR);
                this.handleError(error, socketId);
            },
            close: (code, reason) => {
                log(`Connection ${socketId} closed with code ${code} and reason: ${reason || 'No reason provided'}`, LOG_LEVELS.INFO);
                this.removeSocket(socketId);
            },
            message: (data) => {
                this.handleMessage(socketId, data);
            }
        };

        // Registrar listeners
        Object.entries(listeners).forEach(([event, handler]) => {
            socket.on(event, handler);
        });
        
        // Send initial connection success message
        this.send({ 
            type: 'connected', 
            id: socketId, 
            message: 'Successfully connected to WebSocket server',
            time: Date.now()
        }, socketId);
        
        // Send a heartbeat immediately after connection to test connection
        setTimeout(() => {
            if (this.activeSockets.has(socketId)) {
                this.send({ 
                    type: 'heartbeat', 
                    time: Date.now() 
                }, socketId);
            }
        }, 2000);
        
        return socketId;
    },
    
    // Get active connection count
    getConnectionCount: function() {
        return this.activeSockets.size;
    },
    
    // Send a heartbeat to all clients
    sendHeartbeat: function() {
        return this.broadcast({
            type: 'heartbeat',
            time: Date.now()
        });
    }
};

// Configurar el servidor WebSocket
wsServer.on('connection', (socket, req) => {
    try {
        // Extract windowId from URL if available
        let windowId = null;
        try {
            const url = new URL(req.url, 'http://localhost');
            windowId = url.searchParams.get('windowId');
        } catch (e) {
            console.warn('Could not parse URL for windowId:', e.message);
        }
        
        // Store windowId on socket for reference
        if (windowId) {
            socket.windowId = windowId;
            console.log(`Connection from window: ${windowId}`);
        }
        
        WebSocketManager.setupConnection(socket, req);
    } catch (error) {
        console.error('Error setting up WebSocket connection:', error);
    }
});

// Implementar heartbeat para detectar conexiones muertas
const interval = setInterval(() => {
    WebSocketManager.activeSockets.forEach((socket, id) => {
        // Check if socket has been inactive for more than 45 seconds (increased from 30s)
        const inactiveTime = Date.now() - (socket.lastActivity || 0);
        
        if (socket.isAlive === false || inactiveTime > 45000) {
            log(`Terminating inactive connection ${id} (inactive for ${Math.round(inactiveTime/1000)}s)`, LOG_LEVELS.INFO);
            WebSocketManager.removeSocket(id);
            return;
        }
        
        socket.isAlive = false;
        try {
            socket.ping(() => {
                log(`Sent ping to client ${id}`, LOG_LEVELS.VERBOSE);
            });
        } catch (e) {
            log(`Error sending ping to client ${id}: ${e}`, LOG_LEVELS.ERROR);
            WebSocketManager.removeSocket(id);
        }
    });
}, 15000); // Keep at 15s for heartbeat checks

// Additional heartbeat to all clients every 25 seconds
const heartbeatInterval = setInterval(() => {
    WebSocketManager.sendHeartbeat();
}, 25000);

wsServer.on('close', () => {
    clearInterval(interval);
    clearInterval(heartbeatInterval);
});

wsServer.on('error', (error) => {
    console.error('WebSocket server error:', error);
});

// Handle server shutdown gracefully
process.on('SIGTERM', () => {
    console.log('Shutting down WebSocket server...');
    clearInterval(interval);
    clearInterval(heartbeatInterval);
    wsServer.close(() => {
        console.log('WebSocket server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('Shutting down WebSocket server...');
    clearInterval(interval);
    clearInterval(heartbeatInterval);
    wsServer.close(() => {
        console.log('WebSocket server closed');
        process.exit(0);
    });
});

// Handle uncaught exceptions to prevent server crashes
process.on('uncaughtException', (error) => {
    log(`Uncaught exception: ${error}`, LOG_LEVELS.ERROR);
    log('Server NOT Exiting...', LOG_LEVELS.INFO);
});

module.exports = WebSocketManager;