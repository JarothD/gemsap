import React, { useState } from 'react';
import useWebSocket from '../hooks/useWebSocket';

/**
 * WebSocket status component that shows connection status and messages
 */
const WebSocketStatus = () => {
  const { 
    isConnected, 
    connectionId,
    reconnecting, 
    messages, 
    error, 
    connect, 
    sendMessage,
    clearMessages 
  } = useWebSocket(['progress', 'notification', 'unknown', 'text', 'test', 'connected']);
  
  const [expanded, setExpanded] = useState(true);

  // Send a test message
  const handleSendTest = () => {
    sendMessage({
      type: 'test',
      message: 'Test message',
      timestamp: Date.now()
    });
  };

  // Trigger manual reconnection
  const handleReconnect = () => {
    connect();
  };
  
  // Clear all messages
  const handleClearMessages = () => {
    clearMessages();
  };
  
  // Toggle expanded state
  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  // Safely format message content
  const formatMessage = (data) => {
    if (!data) return 'No data';
    
    if (data.message) {
      return data.message;
    }
    
    try {
      if (typeof data === 'string') {
        return data;
      }
      
      // Remove circular references for safe stringification
      const seen = new WeakSet();
      return JSON.stringify(data, (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular]';
          }
          seen.add(value);
        }
        return value;
      }, 2);
    } catch (err) {
      return `[Error displaying data: ${err.message}]`;
    }
  };

  // Get connection status badge color
  const getStatusColor = () => {
    if (isConnected) return 'green';
    if (reconnecting) return 'orange';
    return 'red';
  };

  // Get connection status text
  const getStatusText = () => {
    if (isConnected) {
      return connectionId 
        ? `Conectado (ID: ${connectionId})` 
        : 'Conectado al servidor WebSocket';
    }
    if (reconnecting) return 'Reconectando...';
    return 'Desconectado del servidor WebSocket';
  };

  return (
    <div className="websocket-status" style={{ 
      margin: '10px', 
      padding: '10px', 
      border: '1px solid #ccc',
      borderRadius: '5px',
      backgroundColor: '#f9f9f9' 
    }}>
      <button 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center', 
          marginBottom: '10px',
          cursor: 'pointer',
          padding: '5px',
          backgroundColor: '#eee',
          borderRadius: '3px',
          width: '100%',
          border: 'none',
          textAlign: 'left'
        }} 
        onClick={toggleExpanded}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Colapsar' : 'Expandir'} panel de estado WebSocket`}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: getStatusColor(),
              marginRight: '10px'
            }}
            aria-hidden="true"
          />
          <span>{getStatusText()}</span>
        </div>
        <span>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <>
          {error && (
            <div style={{ 
              color: 'white', 
              backgroundColor: '#d9534f',
              padding: '5px 10px',
              borderRadius: '3px',
              marginBottom: '10px' 
            }}>
              Error: {error}
            </div>
          )}

          <div style={{ marginBottom: '10px' }}>
            <button 
              onClick={handleSendTest}
              disabled={!isConnected}
              style={{ 
                marginRight: '10px',
                padding: '5px 10px',
                backgroundColor: '#5bc0de',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: isConnected ? 'pointer' : 'not-allowed'
              }}
            >
              Enviar mensaje de prueba
            </button>
            
            <button 
              onClick={handleReconnect} 
              disabled={isConnected || reconnecting}
              style={{ 
                marginRight: '10px',
                padding: '5px 10px',
                backgroundColor: '#5cb85c',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: (!isConnected && !reconnecting) ? 'pointer' : 'not-allowed'
              }}
            >
              Reconectar
            </button>
            
            <button 
              onClick={handleClearMessages}
              style={{ 
                padding: '5px 10px',
                backgroundColor: '#f0ad4e',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
            >
              Limpiar mensajes
            </button>
          </div>

          <div>
            <h4 style={{ borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>
              Mensajes WebSocket:
            </h4>
            {Object.entries(messages).length > 0 ? (
              <ul style={{ 
                listStyle: 'none', 
                padding: '10px',
                maxHeight: '300px',
                overflowY: 'auto',
                backgroundColor: 'white',
                border: '1px solid #eee',
                borderRadius: '3px'
              }}>
                {Object.entries(messages).map(([type, data]) => (
                  <li key={type} style={{ 
                    marginBottom: '8px',
                    padding: '8px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '3px',
                    borderLeft: '3px solid #007bff'
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                      {type}
                    </div>
                    <div style={{ 
                      wordBreak: 'break-word',
                      fontSize: '14px',
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {formatMessage(data)}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: '#666', fontStyle: 'italic' }}>
                No se han recibido mensajes
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default WebSocketStatus; 