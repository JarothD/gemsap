class WebSocketClient {
    constructor(url) {
        this.url = url;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        this.ws = null;
        this.messageHandlers = new Set();
        this.isConnecting = false;
        this.connect();
    }

    connect() {
        if (this.isConnecting) return;
        
        try {
            this.isConnecting = true;
            this.ws = new WebSocket(this.url);
            this.setupEventHandlers();
        } catch (error) {
            console.error('Error al crear WebSocket:', error);
            this.handleReconnection();
        }
    }

    setupEventHandlers() {
        this.ws.onopen = () => {
            console.log("Conexión WebSocket establecida");
            this.reconnectAttempts = 0;
            this.isConnecting = false;
        };

        this.ws.onclose = (event) => {
            console.log('Conexión WebSocket cerrada:', event.code, event.reason);
            this.isConnecting = false;
            if (event.code !== 1000) { // Si no es un cierre normal
                this.handleReconnection();
            }
        };

        this.ws.onerror = (error) => {
            console.error('Error en WebSocket:', error);
            this.isConnecting = false;
        };

        this.ws.onmessage = (event) => {
            this.messageHandlers.forEach(handler => handler(event.data));
        };
    }

    handleReconnection() {
        if (this.reconnectAttempts < this.maxReconnectAttempts && !this.isConnecting) {
            this.reconnectAttempts++;
            console.log(`Intento de reconexión ${this.reconnectAttempts} de ${this.maxReconnectAttempts}`);
            
            setTimeout(() => {
                this.connect();
            }, this.reconnectDelay * this.reconnectAttempts); // Incrementar el delay con cada intento
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Máximo número de intentos de reconexión alcanzado');
        }
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(data);
        } else {
            console.warn('WebSocket no está conectado. El mensaje no pudo ser enviado.');
        }
    }

    close() {
        if (this.ws) {
            this.ws.close(1000, 'Cierre normal'); // Código 1000 indica cierre normal
        }
    }

    addMessageHandler(handler) {
        this.messageHandlers.add(handler);
        return () => this.removeMessageHandler(handler); // Retornar función de limpieza
    }

    removeMessageHandler(handler) {
        this.messageHandlers.delete(handler);
    }
}

const wsClient = new WebSocketClient("ws://localhost:3002");

// Manejar cierre de ventana
window.addEventListener('beforeunload', () => {
    wsClient.close();
});

export default wsClient;