import wsClient from '../../../config/wss';
import Swal from 'sweetalert2';

// Helper function to safely stringify objects for logging
const safeStringify = (obj) => {
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

// Set up a global listener for WebSocket messages that should update Swal
const setupGlobalSwalUpdater = () => {
    log('Setting up global WebSocket listener for Swal updates', LOG_LEVELS.INFO);
    
    // We need to import SwalAlert here to avoid circular dependency
    // Will be importing the exported object, not the module itself
    const SwalAlert = require('../Swal').default;
    
    wsClient.addMessageHandler(data => {
        try {
            // Only log important messages
            const isSystemMessage = data && (
                (typeof data === 'object' && (
                    data.type === 'heartbeat' || 
                    data.type === 'pong' || 
                    data.type === 'ping' || 
                    (data.type === 'connected' && data.silent) // Ignorar mensajes de conexión silenciosos
                )) ||
                (typeof data === 'string' && (
                    data.includes('heartbeat') || 
                    data.includes('ping') || 
                    data.includes('pong')
                ))
            );
            
            // Ignorar mensajes silenciosos completamente
            if (data && data.silent) {
                log(`Ignoring silent message of type: ${data.type}`, LOG_LEVELS.VERBOSE);
                return;
            }
            
            if (!isSystemMessage) {
                // Format the log message to avoid [object Object]
                if (typeof data === 'object' && data !== null) {
                    log('WebSocket message received for Swal update: ' + safeStringify(data), LOG_LEVELS.DEBUG);
                } else {
                    log('WebSocket message received for Swal update: ' + data, LOG_LEVELS.DEBUG);
                }
            }
            
            // Handle different message formats
            try {
                let messageData = data;
                
                // If data is a string, try to parse it as JSON
                if (typeof data === 'string') {
                    try {
                        messageData = JSON.parse(data);
                    } catch (e) {
                        // If it's not valid JSON, use it as is
                        messageData = { message: data };
                    }
                }
                
                // Update Swal for various message types
                if (messageData === 'Ready' || (messageData.type === 'status' && messageData.status === 'ready')) {
                    log('Process completed, showing success message with confirm button', LOG_LEVELS.INFO);
                    
                    // Use SwalAlert's success method directly which has confirmation button
                    SwalAlert.success('¡Proceso completado!', 'La operación ha finalizado con éxito');
                } 
                else if (messageData === 'Error' || (messageData.type === 'error')) {
                    log('Error occurred', LOG_LEVELS.ERROR);
                    SwalAlert.error();
                }
                else if (messageData.type === 'progress' || messageData.type === 'status') {
                    // Actualizaciones intermedias - Mostrar spinner sin botón de aceptar
                    log('Updating Swal with progress message: ' + messageData.message, LOG_LEVELS.DEBUG);
                    
                    if (typeof Swal !== 'undefined' && Swal.isVisible && Swal.isVisible()) {
                        Swal.update({
                            title: messageData.message || messageData.text || 'Procesando...',
                            html: '<div class="custom-loader"></div>',
                            showConfirmButton: false
                        });
                        Swal.showLoading();
                    } else {
                        SwalAlert.updateLoading(messageData.message || messageData.text || 'Procesando...');
                    }
                } 
                else if (typeof messageData.message === 'string') {
                    // Object with message property - Mostrar spinner sin botón
                    log('Updating Swal with message property: ' + messageData.message, LOG_LEVELS.DEBUG);
                    
                    if (typeof Swal !== 'undefined' && Swal.isVisible && Swal.isVisible()) {
                        Swal.update({
                            title: messageData.message,
                            showConfirmButton: false
                        });
                        Swal.showLoading();
                    } else {
                        SwalAlert.updateLoading(messageData.message);
                    }
                }
                else if (typeof messageData === 'string' && messageData !== 'Ready' && messageData !== 'Error') {
                    // Plain string that's not a command - Mostrar spinner sin botón
                    log('Updating Swal with string message: ' + messageData, LOG_LEVELS.DEBUG);
                    
                    if (typeof Swal !== 'undefined' && Swal.isVisible && Swal.isVisible()) {
                        Swal.update({
                            title: messageData,
                            showConfirmButton: false
                        });
                        Swal.showLoading();
                    } else {
                        SwalAlert.updateLoading(messageData);
                    }
                }
                else if (typeof data === 'string' && data !== 'Ready' && data !== 'Error') {
                    // Original string (fallback) - Mostrar spinner sin botón
                    log('Updating Swal with original string: ' + data, LOG_LEVELS.DEBUG);
                    
                    if (typeof Swal !== 'undefined' && Swal.isVisible && Swal.isVisible()) {
                        Swal.update({
                            title: data,
                            showConfirmButton: false
                        });
                        Swal.showLoading();
                    } else {
                        SwalAlert.updateLoading(data);
                    }
                }
            } catch (error) {
                console.error('Error processing WebSocket message in global handler:', error);
            }
        } catch (error) {
            console.error('Error in message handler:', error);
        }
    });
    
    return true;
};

export default setupGlobalSwalUpdater; 