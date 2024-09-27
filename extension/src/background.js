import { createClient } from '@supabase/supabase-js';

let ws = null;
let isConnecting = false;
let supabase;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_INTERVAL = 5000; // 5 seconds

// Initialize Supabase client
const supabaseUrl = 'https://ycjixhoxikzpmgypldxn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inljaml4aG94aWt6cG1neXBsZHhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjYxNDc4NjQsImV4cCI6MjA0MTcyMzg2NH0.iIq2NJIO49jQ5XwuKZlE175HBGZhBpaUpec9p6354AA';

// Function to initialize Supabase client with a session
function initSupabase(session) {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  });
  if (session) {
    supabase.auth.setSession(session);
  }
}

// Function to refresh the session
async function refreshSession() {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) throw error;
    if (data.session) {
      chrome.storage.local.set({ supabaseSession: data.session });
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error refreshing session:', error);
    return false;
  }
}

// Function to check and refresh the session
async function checkAndRefreshSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    if (new Date(session.expires_at) < new Date()) {
      return await refreshSession();
    }
    return true;
  }
  return false;
}

// Initialize Supabase and WebSocket on extension load
chrome.runtime.onInstalled.addListener(async (details) => {
  const { supabaseSession } = await chrome.storage.local.get('supabaseSession');
  if (supabaseSession) {
    initSupabase(supabaseSession);
    if (await checkAndRefreshSession()) {
      initWebSocket();
    }
  } else {
    initSupabase();
  }

  // Request notification permission on install
  if (details.reason === 'install') {
    chrome.notifications.getPermissionLevel((level) => {
      if (level !== 'granted') {
        chrome.permissions.request({
          permissions: ['notifications']
        }, (granted) => {
          if (granted) {
            console.log('Notification permission granted');
          } else {
            console.log('Notification permission denied');
          }
        });
      }
    });
  }
  checkNotificationPermission(); // Check permission on install
});

// Periodically check and refresh the session
setInterval(async () => {
  if (await checkAndRefreshSession()) {
    if (!ws || ws.readyState === WebSocket.CLOSED) {
      initWebSocket();
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes

// Function to initialize WebSocket connection
function initWebSocket() {
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

  // Use wss:// for production, ws:// for local development
  const wsUrl = process.env.NODE_ENV === 'production' 
    ? 'wss://your-production-domain.com/ws' 
    : 'ws://localhost:3000/ws';

  ws = new WebSocket(wsUrl);

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

function handleWebSocketMessage(event) {
  console.log('Received:', event.data);
  try {
    const data = JSON.parse(event.data);
    if (data.type === 'clipboard') {
      handleClipboardMessage(data);
    } else if (data.type === 'auth_success') {
      console.log('Authentication successful');
    } else if (data.type === 'auth_error') {
      console.error('Authentication failed:', data.error);
      ws.close();
    }
  } catch (error) {
    console.error('Error parsing message:', error);
  }
}

function handleClipboardMessage(data) {
  console.log('Handling clipboard message:', data);
  
  chrome.notifications.getPermissionLevel((level) => {
    console.log('Notification permission level:', level);
    
    if (level === 'granted') {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icon128.png'),
        title: 'New clipboard content received',
        message: data.content.substring(0, 50) + (data.content.length > 50 ? '...' : '')
      }, (notificationId) => {
        if (chrome.runtime.lastError) {
          console.error('Notification creation failed:', chrome.runtime.lastError);
          // Inform the popup that notifications are not working
          chrome.runtime.sendMessage({ action: 'notifyPermissionDenied' });
        } else {
          console.log('Notification created with ID:', notificationId);
        }
      });
    } else {
      console.log('Notification permission not granted.');
      chrome.runtime.sendMessage({ action: 'notifyPermissionDenied' });
    }
  });

  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]) {
      sendMessageToTab(tabs[0].id, {
        action: 'showNotificationAndCopy',
        content: data.content
      });
    } else {
      console.log('No active tab found to send message');
    }
  });
}

function sendMessageToTab(tabId, message) {
  chrome.tabs.sendMessage(tabId, message, function(response) {
    if (chrome.runtime.lastError) {
      console.log('Error sending message to tab:', chrome.runtime.lastError.message);
      injectContentScriptAndRetry(tabId, message);
    } else if (response) {
      console.log('Message sent successfully:', response);
    }
  });
}

function injectContentScriptAndRetry(tabId, message) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['content.js']
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error injecting content script:', chrome.runtime.lastError.message);
    } else {
      sendMessageToTab(tabId, message);
    }
  });
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

async function sendAuthMessage() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('No active session');
      return;
    }
    const deviceId = await getDeviceId();
    const authMessage = JSON.stringify({
      type: 'auth',
      token: session.access_token,
      deviceId: deviceId
    });
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(authMessage);
    } else {
      console.error('WebSocket is not open. Unable to send auth message.');
    }
  } catch (error) {
    console.error('Error sending auth message:', error);
  }
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function getDeviceId() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['deviceId'], function(result) {
      if (result.deviceId && result.deviceId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
        resolve(result.deviceId);
      } else {
        const newDeviceId = generateUUID();
        chrome.storage.local.set({ deviceId: newDeviceId }, function() {
          resolve(newDeviceId);
        });
      }
    });
  });
}

// Function to send clipboard content to the server via WebSocket
async function sendClipboardContent(content) {
  try {
    if (await checkAndRefreshSession()) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('User not authenticated');
        return { success: false, error: 'User not authenticated' };
      }
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        console.log('WebSocket not open, attempting to reconnect...');
        await new Promise((resolve, reject) => {
          initWebSocket();
          const timeout = setTimeout(() => {
            reject(new Error('WebSocket connection timeout'));
          }, 10000); // 10 seconds timeout
          ws.onopen = () => {
            clearTimeout(timeout);
            resolve();
          };
        });
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'clipboard', content }));
        return { success: true };
      } else {
        throw new Error('WebSocket not in OPEN state after reconnection attempt');
      }
    } else {
      throw new Error('User not authenticated');
    }
  } catch (error) {
    console.error('Error sending clipboard content:', error);
    return { success: false, error: error.message };
  }
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkAuth') {
    checkAuthStatus().then(sendResponse);
    return true;  // Indicates an asynchronous response
  } else if (request.action === 'login') {
    login(request.email, request.password).then(sendResponse);
    return true;
  } else if (request.action === 'logout') {
    logout().then(sendResponse);
    return true;
  } else if (request.action === 'sendClipboardContent') {
    sendClipboardContent(request.content).then(sendResponse);
    return true;
  }
});

async function checkAuthStatus() {
  try {
    if (!supabase) {
      console.error('Supabase client not initialized');
      return { isAuthenticated: false, error: 'Supabase client not initialized' };
    }
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return { isAuthenticated: !!data.session };
  } catch (error) {
    console.error('Error checking auth status:', error);
    return { isAuthenticated: false, error: error.message };
  }
}

async function login(email, password) {
  try {
    if (!supabase) {
      console.error('Supabase client not initialized');
      return { success: false, error: 'Supabase client not initialized' };
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });
    if (error) throw error;
    console.log('Login successful, user:', data.user);
    chrome.storage.local.set({ supabaseSession: data.session });
    initWebSocket();
    return { success: true, user: data.user };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: error.message };
  }
}

async function logout() {
  try {
    if (!supabase) {
      console.error('Supabase client not initialized');
      return { success: false, error: 'Supabase client not initialized' };
    }
    await supabase.auth.signOut();
    if (ws) ws.close();
    chrome.storage.local.remove('supabaseSession');
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return { success: false, error: error.message };
  }
}

// Function to check notification permission
function checkNotificationPermission() {
  chrome.notifications.getPermissionLevel((level) => {
    if (level !== 'granted') {
      // Send a message to the popup to inform the user
      chrome.runtime.sendMessage({ action: 'notifyPermissionDenied' });
    }
  });
}

// Initialize WebSocket connection when the service worker starts
chrome.runtime.onStartup.addListener(() => {
  checkAuthStatus().then(({ isAuthenticated }) => {
    if (isAuthenticated) {
      initWebSocket();
    }
    checkNotificationPermission(); // Check permission on startup
  });
});

// Set up periodic WebSocket status check
setInterval(() => {
  if (!ws || ws.readyState === WebSocket.CLOSED) {
    console.log('WebSocket is not connected. Attempting to reconnect...');
    initWebSocket();
  }
}, 30000); // Check every 30 seconds