import { getCurrentSession } from './supabaseService';
import { getDeviceId } from '../utils';

let ws = null;
let isConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_INTERVAL = 5000; // 5 seconds

export function initWebSocket() {
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

  ws = new WebSocket(process.env.REACT_APP_WS_URL);

  ws.onopen = () => {
    console.log('WebSocket connected');
    isConnecting = false;
    reconnectAttempts = 0;
    sendAuthMessage();
  };

  ws.onmessage = handleWebSocketMessage;
  ws.onerror = handleWebSocketError;
  ws.onclose = handleWebSocketClose;

  console.log('WebSocket initial state:', ws.readyState);
}

export async function sendAuthMessage() {
  try {
    const currentSession = getCurrentSession();
    if (!currentSession) {
      console.error('No active session');
      return;
    }

    const deviceId = await getDeviceId();
    const authMessage = JSON.stringify({
      type: 'auth',
      token: currentSession.access_token,
      deviceId: deviceId
    });

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(authMessage);
      console.log('Auth message sent:', authMessage);
    } else {
      console.error('WebSocket is not open. Unable to send auth message.');
    }
  } catch (error) {
    console.error('Error sending auth message:', error);
  }
}

function handleWebSocketMessage(event) {
  console.log('Received:', event.data);
  try {
    const data = JSON.parse(event.data);
    if (data.type === 'clipboard') {
      // Handle clipboard message
    } else if (data.type === 'auth_success') {
      console.log('Authentication successful');
    } else if (data.type === 'auth_error') {
      console.error('Authentication failed:', data.error);
      if (data.error === 'Not authenticated') {
        console.log('Retrying authentication...');
        sendAuthMessage();
      }
    }
  } catch (error) {
    console.error('Error parsing message:', error);
  }
}

function handleWebSocketError(error) {
  console.error('WebSocket error:', error);
  isConnecting = false;
}

function handleWebSocketClose(event) {
  console.log('WebSocket disconnected:', event.code, event.reason);
  isConnecting = false;
  ws = null;

  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts++;
    console.log(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
    setTimeout(initWebSocket, RECONNECT_INTERVAL * reconnectAttempts);
  } else {
    console.error('Max reconnection attempts reached');
  }
}

export function getWebSocket() {
  return ws;
}