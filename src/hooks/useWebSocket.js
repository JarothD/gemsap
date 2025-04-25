import { useState, useEffect, useRef, useCallback } from 'react';
import wsClient from '../config/wss';

/**
 * React hook for using WebSocket
 * @param {Array} messageTypes - Types of messages to listen for
 * @returns {Object} - WebSocket connection state and methods
 */
const useWebSocket = () => {
  // Store reference to the WebSocket client to prevent re-creating instances
  const clientRef = useRef(wsClient);
  
  // Connection state and ID
  const [connected, setConnected] = useState(clientRef.current.isConnected());
  const [connectionId, setConnectionId] = useState(clientRef.current.getConnectionId());
  
  // Last received message data
  const [lastMessage, setLastMessage] = useState(null);
  
  // Last error if any
  const [error, setError] = useState(null);
  
  // Track consecutive connection failures
  const connectionFailures = useRef(0);
  
  // Track if component is mounted to prevent state updates after unmount
  const isMounted = useRef(true);
  
  // Handle incoming messages
  const handleMessage = useCallback((data) => {
    if (!isMounted.current) return;
    
    // Reset connection failures counter on successful message
    connectionFailures.current = 0;
    
    // Only update state if the component is still mounted
    setLastMessage(data);
    
    // Capture connection ID from 'connected' messages
    if (data && data.type === 'connected' && data.id) {
      setConnectionId(data.id);
    }
  }, []);
  
  // Send a message through the WebSocket
  const sendMessage = useCallback((messageToSend) => {
    if (!clientRef.current) {
      setError(new Error('WebSocket client not initialized'));
      return false;
    }
    
    return clientRef.current.send(messageToSend);
  }, []);
  
  // Check connection status
  const checkConnection = useCallback(() => {
    if (!clientRef.current) return false;
    
    const isConnected = clientRef.current.isConnected();
    
    // Only update state if there's a change
    if (connected !== isConnected && isMounted.current) {
      setConnected(isConnected);
      setConnectionId(clientRef.current.getConnectionId());
      
      // Si perdimos la conexión, incrementar contador de fallos
      if (!isConnected) {
        connectionFailures.current += 1;
        
        // Si detectamos múltiples fallos consecutivos, forzar reconexión
        if (connectionFailures.current >= 2) {
          setTimeout(() => {
            reconnect();
          }, 1000);
        }
      } else {
        // Reset contador si estamos conectados
        connectionFailures.current = 0;
      }
    }
    
    return isConnected;
  }, [connected]);
  
  // Force a reconnection
  const reconnect = useCallback(() => {
    if (!clientRef.current) return;
    
    try {
      clientRef.current.reconnect();
      console.log('Forzando reconexión WebSocket');
    } catch (err) {
      if (isMounted.current) {
        setError(err);
      }
    }
  }, []);
  
  // Setup WebSocket on component mount
  useEffect(() => {
    // Check connection status more frequently (cada segundo)
    const statusInterval = setInterval(() => {
      checkConnection();
    }, 1000);
    
    // Setup message handler
    const removeHandler = clientRef.current.addMessageHandler(handleMessage);
    
    // Initial connection check
    checkConnection();
    
    // Si no estamos conectados al inicio, intentar reconexión
    if (!clientRef.current.isConnected()) {
      setTimeout(reconnect, 1000);
    }
    
    // Cleanup function
    return () => {
      isMounted.current = false;
      clearInterval(statusInterval);
      
      // Remove message handler when component unmounts
      if (removeHandler) {
        removeHandler();
      }
    };
  }, [checkConnection, handleMessage, reconnect]);
  
  // Return the WebSocket control interface and state
  return {
    connected,
    connectionId,
    lastMessage,
    error,
    sendMessage,
    checkConnection,
    reconnect
  };
};

export default useWebSocket; 