let ws = null;
let isConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_INTERVAL = 5000; // 5 seconds
let previousData = null; // Store the last data sent to the WebSocket

function initWebSocket(config) {
  const { 
    wsUrl, 
    onOpen, 
    onMessage, 
    onError, 
    onClose, 
    getAuthMessage 
  } = config;

  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
    console.log('WebSocket is already connected or connecting');
    return;
  }

  if (isConnecting) {
    console.log('WebSocket connection attempt already in progress');
    return;
  }

  isConnecting = true;
  console.log('Initializing WebSocket connection...');

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket connected');
    isConnecting = false;
    reconnectAttempts = 0;
    const authMessage = getAuthMessage();
    if (authMessage) {
      sendMessage(authMessage);
    }
    if (onOpen) onOpen();
  };

  ws.onmessage = (event) => {
    console.log('Received:', event.data);
    if (onMessage) onMessage(event);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    if (onError) onError(error);
  };

  ws.onclose = (event) => {
    console.log('WebSocket disconnected:', event.code, event.reason);
    isConnecting = false;
    ws = null;
    if (onClose) onClose(event);

    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      console.log(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
      setTimeout(() => initWebSocket(config), RECONNECT_INTERVAL * reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
    }
  };

  console.log('WebSocket initial state:', ws.readyState);
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

export {
  initWebSocket,
  sendMessage,
  closeWebSocket,
  getWebSocketState
};