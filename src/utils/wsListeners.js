// This file is imported by src/components/util/utils/wsListeners.js
// It acts as a bridge and entry point to test WebSocket functionality
import wsClient from '../config/wss';

// Export a function to manually send test messages via WebSocket
// This can be used in browser console to test the Swal update functionality
export const sendTestMessage = (message) => {
    console.log('Sending test message:', message);
    return wsClient.send(message);
};

// Export a function to check WebSocket connection status
export const checkConnection = () => {
    return wsClient.isConnected();
};

// Export wsClient for manual debugging
export default wsClient; 