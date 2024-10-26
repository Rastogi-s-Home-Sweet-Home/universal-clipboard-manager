let ws = null;
let isConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_INTERVAL = 5000; // 5 seconds
let previousData = null; // Store the last data sent to the WebSocket

function initWebSocket({ wsUrl, getAuthMessage, onOpen, onMessage, onError, onClose }) {
  return new Promise(async (resolve, reject) => {
    try {
      if (ws) {
        ws.close();
      }

      ws = new WebSocket(wsUrl);
      
      ws.onopen = async () => {
        try {
          const authMessage = await getAuthMessage();
          console.log('Sending auth message:', authMessage); // Debug log
          ws.send(JSON.stringify(authMessage));
          onOpen?.();
          resolve(ws);
        } catch (error) {
          console.error('Error in onopen handler:', error);
          reject(error);
        }
      };

      ws.onmessage = onMessage;
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        onError?.(error);
      };
      ws.onclose = onClose;
    } catch (error) {
      console.error('Error initializing WebSocket:', error);
      reject(error);
    }
  });
}

function sendMessage(message) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(typeof message === 'string' ? message : JSON.stringify(message));
    previousData = message; // Store the data to retry
  } else {
    console.error('WebSocket is not open. Unable to send message.');
  }
}

function closeWebSocket() {
  if (ws) {
    ws.close();
    ws = null;
  }
}

function getWebSocketState() {
  return ws ? ws.readyState : WebSocket.CLOSED;
}

// Single export statement for all functions
export {
  initWebSocket,
  sendMessage,
  closeWebSocket,
  getWebSocketState
};
