// Safe import of electron modules that works in both browser and Node environments
let wsIPC = null;
try {
    // Check if we're in Electron renderer process and wsIPC is available
    if (typeof window !== 'undefined' && window.wsIPC) {
        wsIPC = window.wsIPC;
    }
} catch (e) {
    console.warn('Not running in Electron renderer process or wsIPC not available');
}

// Helper function to format objects for logging
const formatLog = (obj) => {
    try {
        if (typeof obj === 'object' && obj !== null) {
            return JSON.stringify(obj);
        }
        return String(obj);
    } catch (e) {
        return `[Non-serializable object: ${e.message}]`;
    }
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

// WebSocket singleton to ensure only one connection exists in the entire application
class WebSocketClient {
    constructor() {
        // Check for existing instance
        if (typeof window !== 'undefined' && window.ElectronWSInstance) {
            console.log('Using existing WebSocket instance');
            return window.ElectronWSInstance;
        }
        
        // Private properties
        this.ws = null;
        this.messageHandlers = new Set();
        this.connectionId = null;
        this.reconnectionTimer = null;
        this.isReconnecting = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.destroyed = false;
        this.connected = false;
        this.windowID = this._generateWindowId();
        this.pendingMessages = [];
        this.heartbeatTimer = null;
        this.lastActivity = Date.now();
        this.isPassive = false; // Flag to indicate if this instance should remain passive
        
        // Store in global window object for singleton pattern
        if (typeof window !== 'undefined') {
            window.ElectronWSInstance = this;
        }
        
        // Configure IPC communications if in Electron
        this._setupIPC();
        
        // Handle window unload
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', () => {
                this._cleanupBeforeUnload();
            });
        }
        
        // Initial connection (delayed to prevent race conditions)
        setTimeout(() => this.connect(), 1000);
    }
    
    // Private method to generate a unique window identifier
    _generateWindowId() {
        return `window_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }
    
    // Private method to set up IPC communication with main process
    _setupIPC() {
        if (wsIPC) {
            // Register event handlers for IPC communication
            
            // Handle reconnection request from main process
            this._cleanupHandlers = [];
            
            const reconnectHandler = () => {
                console.log('Received reconnect command from main process');
                this.reconnect();
            };
            this._cleanupHandlers.push(wsIPC.onReconnect(reconnectHandler));
            
            // Handle forced disconnect from main process
            const disconnectHandler = () => {
                console.log('Received disconnect command from main process');
                this.close();
            };
            this._cleanupHandlers.push(wsIPC.onDisconnect(disconnectHandler));
            
            // Handle passive mode instruction from main process
            const passiveHandler = (data) => {
                console.log('Received instruction to make WebSocket passive:', data);
                this.isPassive = true;
                this.close();
            };
            this._cleanupHandlers.push(wsIPC.onMakePassive(passiveHandler));
            
            // Handle activation instruction from main process
            const activateHandler = () => {
                console.log('Received instruction to activate WebSocket');
                this.isPassive = false;
                this.reconnect();
            };
            this._cleanupHandlers.push(wsIPC.onActivate(activateHandler));
            
            // Notify main process that WebSocket is initialized
            try {
                wsIPC.initialized({
                    windowId: this.windowID,
                    timestamp: Date.now()
                });
            } catch (e) {
                console.warn('Could not send initialization message to main process:', e);
            }
        }
    }
    
    // Connect to WebSocket server
    connect() {
        // Prevent connecting if already connecting, destroyed, or passive
        if (this.ws || this.isReconnecting || this.destroyed || this.isPassive) {
            return;
        }
        
        // Reset reconnection state
        this.isReconnecting = true;
        
        try {
            console.log('Connecting to WebSocket:', 'ws://localhost:3002');
            
            // Create new WebSocket connection with window ID
            this.ws = new WebSocket(`ws://localhost:3002?windowId=${this.windowID}`);
            
            // Setup event listeners
            this.ws.onopen = this._handleOpen.bind(this);
            this.ws.onclose = this._handleClose.bind(this);
            this.ws.onerror = this._handleError.bind(this);
            this.ws.onmessage = this._handleMessage.bind(this);
            
            // Set connection timeout
            this.connectionTimeout = setTimeout(() => {
                if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
                    console.warn('WebSocket connection timeout after 10 seconds');
                    this.ws.close();
                }
            }, 10000);
        } catch (error) {
            console.error('Error creating WebSocket connection:', error);
            this._scheduleReconnect();
        }
    }
    
    // Handle successful connection
    _handleOpen() {
        console.log('WebSocket connection established');
        this.connected = true;
        this.isReconnecting = false;
        this.reconnectAttempts = 0;
        
        // Clear connection timeout
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
        
        // Send identification message
        this.send({
            type: 'identity',
            windowId: this.windowID
        });
        
        // Send any pending messages
        if (this.pendingMessages.length > 0) {
            console.log(`Sending ${this.pendingMessages.length} pending messages`);
            const messages = [...this.pendingMessages];
            this.pendingMessages = [];
            
            // Process with slight delay to ensure stable connection
            setTimeout(() => {
                messages.forEach(msg => this.send(msg));
            }, 500);
        }
        
        // Start heartbeat to keep connection alive
        this._startHeartbeat();
    }
    
    // Handle connection close
    _handleClose(event) {
        this.connected = false;
        this.ws = null;
        
        // Clear timers
        this._stopHeartbeat();
        
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
        
        console.log(`WebSocket connection closed: ${event.code} - ${event.reason || 'No reason'}`);
        
        // Notify main process of disconnection
        if (wsIPC && !this.destroyed) {
            try {
                wsIPC.disconnected({
                    windowId: this.windowID,
                    timestamp: Date.now()
                });
            } catch (e) {
                console.warn('Could not send disconnection message to main process:', e);
            }
        }
        
        // Don't attempt to reconnect if deliberately destroyed, closed, or in passive mode
        if (!this.destroyed && !this.isPassive) {
            this._scheduleReconnect();
        }
    }
    
    // Handle connection error
    _handleError(error) {
        console.error('WebSocket error:', error);
        // No need to do anything here - onclose will be called after an error
    }
    
    // Handle incoming message
    _handleMessage(event) {
        try {
            // Update activity timestamp
            this.lastActivity = Date.now();
            
            let data;
            try {
                data = JSON.parse(event.data);
            } catch (e) {
                data = event.data;
            }
            
            // Store connection ID if received in connection message
            if (data && data.type === 'connected') {
                this.connectionId = data.id;
                log(`Connection established with ID: ${this.connectionId}`, LOG_LEVELS.INFO);
                
                // No procesar este mensaje más adelante si es silencioso
                if (data.silent) {
                    return;
                }
            }
            
            // Only log important messages
            const isSystemMessage = data && (
                data.type === 'heartbeat' || 
                data.type === 'pong' || 
                data.type === 'ping' || 
                (data.type === 'connected' && data.silent) // Ignorar mensajes de conexión silenciosos
            );
            
            if (!isSystemMessage) {
                log('WebSocket message received: ' + (typeof data === 'object' ? formatLog(data) : data), LOG_LEVELS.INFO);
            } else {
                log(`Received ${data.type} message`, LOG_LEVELS.VERBOSE);
            }
            
            // Notify all message handlers
            this.messageHandlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error('Error in message handler:', error);
                }
            });
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
        }
    }
    
    // Schedule reconnection with exponential backoff
    _scheduleReconnect() {
        if (this.destroyed || this.reconnectionTimer) {
            return;
        }
        
        this.isReconnecting = true;
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            
            // Exponential backoff with minimum delay of 3 seconds
            const delay = Math.min(3000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
            
            console.log(`Scheduling reconnection attempt ${this.reconnectAttempts} of ${this.maxReconnectAttempts} in ${Math.floor(delay/1000)}s`);
            
            this.reconnectionTimer = setTimeout(() => {
                this.reconnectionTimer = null;
                this.connect();
            }, delay);
        } else {
            console.error('Maximum reconnection attempts reached');
            this.isReconnecting = false;
            
            // Reset reconnect attempts after a longer cooling period
            setTimeout(() => {
                if (!this.destroyed) {
                    console.log('Resetting reconnection attempts after cooling period');
                    this.reconnectAttempts = 0;
                    this.connect();
                }
            }, 60000); // 1 minute cooling period
        }
    }
    
    // Start heartbeat to keep connection alive
    _startHeartbeat() {
        this._stopHeartbeat();
        
        // Send ping every 30 seconds
        this.heartbeatTimer = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.send({
                    type: 'ping',
                    timestamp: Date.now(),
                    windowId: this.windowID
                });
            }
        }, 30000);
    }
    
    // Stop heartbeat
    _stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }
    
    // Cleanup before window unload
    _cleanupBeforeUnload() {
        // Mark as deliberately destroyed
        this.destroyed = true;
        
        // Clear all timers
        this._stopHeartbeat();
        
        if (this.reconnectionTimer) {
            clearTimeout(this.reconnectionTimer);
            this.reconnectionTimer = null;
        }
        
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
        
        // Clean up IPC handlers
        if (this._cleanupHandlers) {
            this._cleanupHandlers.forEach(cleanup => {
                if (typeof cleanup === 'function') {
                    try {
                        cleanup();
                    } catch (e) {
                        console.warn('Error cleaning up IPC handler:', e);
                    }
                }
            });
        }
        
        // Close WebSocket if open
        if (this.ws) {
            try {
                this.ws.onclose = null; // Remove close handler to prevent reconnection
                this.ws.close();
            } catch (e) {
                console.warn('Error closing WebSocket during cleanup:', e);
            }
            this.ws = null;
        }
        
        console.log('WebSocket resources cleaned up before unload');
    }
    
    // Public method to send message
    send(data) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            // Queue message for later if not connected
            if (!this.destroyed) {
                // Only log important messages
                const isSystemMessage = data && (
                    (typeof data === 'object' && (data.type === 'heartbeat' || data.type === 'ping' || data.type === 'pong')) ||
                    (typeof data === 'string' && (data.includes('heartbeat') || data.includes('ping') || data.includes('pong')))
                );
                
                if (!isSystemMessage) {
                    log('WebSocket not connected, queueing message: ' + (typeof data === 'object' ? formatLog(data) : data), LOG_LEVELS.INFO);
                } else {
                    log(`Queueing ${typeof data === 'object' ? data.type : 'system'} message`, LOG_LEVELS.VERBOSE);
                }
                
                this.pendingMessages.push(data);
                
                // Limit queue size to prevent memory issues
                if (this.pendingMessages.length > 50) {
                    this.pendingMessages = this.pendingMessages.slice(-50);
                }
                
                // Attempt to connect if not already reconnecting
                if (!this.isReconnecting && !this.ws) {
                    this.connect();
                }
            }
            return false;
        }
        
        try {
            // Only log important messages
            const isSystemMessage = data && (
                (typeof data === 'object' && (data.type === 'heartbeat' || data.type === 'ping' || data.type === 'pong')) ||
                (typeof data === 'string' && (data.includes('heartbeat') || data.includes('ping') || data.includes('pong')))
            );
            
            if (!isSystemMessage) {
                log('Sending WebSocket message: ' + (typeof data === 'object' ? formatLog(data) : data), LOG_LEVELS.INFO);
            } else {
                log(`Sending ${typeof data === 'object' ? data.type : 'system'} message`, LOG_LEVELS.VERBOSE);
            }
            
            const message = typeof data === 'string' ? data : JSON.stringify(data);
            this.ws.send(message);
            return true;
        } catch (error) {
            console.error('Error sending WebSocket message:', error);
            return false;
        }
    }
    
    // Public method to manually reconnect
    reconnect() {
        console.log('Manual reconnection requested');
        
        // Reset reconnection state
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        this.isPassive = false; // Clear passive flag on manual reconnect
        
        // Clear any existing timers
        if (this.reconnectionTimer) {
            clearTimeout(this.reconnectionTimer);
            this.reconnectionTimer = null;
        }
        
        // Close existing connection
        if (this.ws) {
            try {
                this.ws.onclose = null; // Remove close handler to prevent reconnection loop
                this.ws.close();
            } catch (e) {
                console.warn('Error closing WebSocket during reconnect:', e);
            }
            this.ws = null;
        }
        
        // Connect after a short delay
        setTimeout(() => this.connect(), 500);
        
        // Optionally notify main process to coordinate with other windows
        if (wsIPC) {
            try {
                wsIPC.reconnectRequest({
                    windowId: this.windowID,
                    timestamp: Date.now()
                });
            } catch (e) {
                console.warn('Could not send reconnect request to main process:', e);
            }
        }
    }
    
    // Public method to close connection
    close() {
        console.log('Manually closing WebSocket connection');
        
        // Clear all timers
        this._stopHeartbeat();
        
        if (this.reconnectionTimer) {
            clearTimeout(this.reconnectionTimer);
            this.reconnectionTimer = null;
        }
        
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
        
        // Close WebSocket if open
        if (this.ws) {
            try {
                this.ws.onclose = null; // Remove close handler to prevent reconnection
                this.ws.close();
            } catch (e) {
                console.warn('Error closing WebSocket:', e);
            }
            this.ws = null;
        }
        
        this.connected = false;
        
        // Notify main process of disconnection if not in passive mode
        if (wsIPC && !this.isPassive) {
            try {
                wsIPC.disconnected({
                    windowId: this.windowID,
                    timestamp: Date.now()
                });
            } catch (e) {
                console.warn('Could not send disconnection message to main process:', e);
            }
        }
    }
    
    // Public method to check if connected
    isConnected() {
        return this.connected && this.ws && this.ws.readyState === WebSocket.OPEN;
    }
    
    // Public method to get connection ID
    getConnectionId() {
        return this.connectionId;
    }
    
    // Public method to add message handler
    addMessageHandler(handler) {
        if (typeof handler !== 'function') {
            throw new Error('Message handler must be a function');
        }
        
        this.messageHandlers.add(handler);
        
        // Return function to remove handler
        return () => this.removeMessageHandler(handler);
    }
    
    // Public method to remove message handler
    removeMessageHandler(handler) {
        return this.messageHandlers.delete(handler);
    }
    
    // Public method to check if in passive mode
    isPassiveMode() {
        return this.isPassive;
    }
}

// Create a singleton instance
const wsInstance = new WebSocketClient();

// Export the instance for React components
export default wsInstance;