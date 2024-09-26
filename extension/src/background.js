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

// Initialize Supabase on extension load
chrome.storage.local.get(['supabaseSession'], function(result) {
  if (result.supabaseSession) {
    initSupabase(result.supabaseSession);
    initWebSocket();
  } else {
    initSupabase();
  }
});

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

  ws.onmessage = (event) => {
    console.log('Received:', event.data);
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'clipboard') {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'showNotificationAndCopy',
              content: data.content
            }, function(response) {
              if (chrome.runtime.lastError) {
                console.log('Error sending message to tab:', chrome.runtime.lastError.message);
                // If the content script isn't ready, inject it and try again
                chrome.scripting.executeScript({
                  target: { tabId: tabs[0].id },
                  files: ['content.js']
                }, () => {
                  if (chrome.runtime.lastError) {
                    console.error('Error injecting content script:', chrome.runtime.lastError.message);
                  } else {
                    // Try sending the message again after injecting the content script
                    chrome.tabs.sendMessage(tabs[0].id, {
                      action: 'showNotificationAndCopy',
                      content: data.content
                    });
                  }
                });
              } else if (response) {
                console.log('Message sent successfully:', response);
              }
            });
          } else {
            console.log('No active tab found to send message');
          }
        });
      } else if (data.type === 'auth_success') {
        console.log('Authentication successful');
      } else if (data.type === 'auth_error') {
        console.error('Authentication failed:', data.error);
        ws.close();
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    isConnecting = false;
  };

  ws.onclose = (event) => {
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
  };

  console.log('WebSocket initial state:', ws.readyState);
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
  } catch (error) {
    console.error('Error sending clipboard content:', error);
    return { success: false, error: error.message };
  }
}

// Listen for messages from content scripts
chrome.runtime.onInstalled.addListener(async () => {
  await checkAuthStatus();
});

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
    // Store the session in Chrome's storage
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
    // Clear the stored session
    chrome.storage.local.remove('supabaseSession');
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return { success: false, error: error.message };
  }
}

// Initialize WebSocket connection when the service worker starts
chrome.runtime.onStartup.addListener(() => {
  checkAuthStatus().then(({ isAuthenticated }) => {
    if (isAuthenticated) {
      initWebSocket();
    }
  });
});

// Add a function to check WebSocket connection status
function checkWebSocketStatus() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.log('WebSocket is not connected. Attempting to reconnect...');
    initWebSocket();
  }
}

// Set up periodic WebSocket status check
setInterval(() => {
  if (!ws || ws.readyState === WebSocket.CLOSED) {
    console.log('WebSocket is not connected. Attempting to reconnect...');
    initWebSocket();
  }
}, 30000); // Check every 30 seconds