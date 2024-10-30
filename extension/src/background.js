import { createClient } from '@supabase/supabase-js';
import { initWebSocket, sendMessage, closeWebSocket, getWebSocketState } from './services/webSocketService';
import { getOrCreateDeviceId, getDeviceName } from './utils/deviceUtils';
import { saveToHistory } from './utils/dbUtils';
import supabaseService from './services/supabaseService';
import { epochToMs } from './utils/timeUtils';

let currentUser = null;
let currentSession = null;

// Add these imports and constants at the top
const PING_INTERVAL = 30000; // 30 seconds
let pingIntervalId = null;

// Closure to manage clipboard data
const clipboardManager = (() => {
  let clipboardData = null; // Private variable

  return {
    setClipboardData: (data) => {
      clipboardData = data;
    },
    getClipboardData: () => {
      return clipboardData;
    },
    clearClipboardData: () => {
      clipboardData = null;
    }
  };
})();

// Function to register push notification
async function registerPushNotification() {
  try {
    const { data: { session } } = await supabaseService.getSession();
    if (session) {
      const deviceId = await getOrCreateDeviceId();
      
      // Subscribe to push using the service worker (background.js itself)
      const subscription = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.REACT_APP_VAPID_PUBLIC_KEY)
      });

      const subscribeUrl = `${process.env.REACT_APP_API_URL}/subscribe`;
      const response = await fetch(subscribeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          subscription,
          deviceId
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to send subscription to server: ${errorText}`);
      }

      console.log('Push notification subscription registered');
    }
  } catch (error) {
    console.error('Error registering push notification:', error);
    throw error;
  }
}

// Function to refresh the session
async function refreshSession() {
  try {
    const { data, error } = await supabaseService.refreshSession();
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
  try {
    if (!currentSession) {
      const { data: { session } } = await supabaseService.getSession();
      currentSession = session;
    }
    if (currentSession) {
      const expiresAt = new Date(epochToMs(currentSession.expires_at));
      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60000);

      console.log('Current time:', now.toISOString());
      console.log('Session expires at:', expiresAt.toISOString());
      console.log('Five minutes from now:', fiveMinutesFromNow.toISOString());

      if (expiresAt < fiveMinutesFromNow) {
        console.log('Session expiring soon, refreshing...');
        const { data, error } = await supabaseService.refreshSession();
        if (error) throw error;
        currentSession = data.session;
        chrome.storage.local.set({ supabaseSession: currentSession });
        console.log('Session refreshed successfully');
      }
      return true;
    }
    console.log('No current session found');
    return false;
  } catch (error) {
    logError('Error refreshing session', error);
    return false;
  }
}

const WAKE_INTERVAL = 25;

// Keep only this single consolidated onInstalled listener
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed/updated:', details.reason);

  // Initialize core services
  await initializeSupabaseAndWebSocket();

  // Set up keep-alive alarm
  chrome.alarms.create('keepAlive', {
    periodInMinutes: WAKE_INTERVAL
  });
});

// Single onStartup handler
chrome.runtime.onStartup.addListener(async () => {
  console.log('Extension starting up...');
  await initializeSupabaseAndWebSocket();
});

// Single interval for both session and WebSocket checks
const CHECK_INTERVAL = 30000; // 30 seconds
setInterval(async () => {
  // Check session first
  if (await checkAndRefreshSession()) {
    console.log('Session is valid');
    // Then check WebSocket state
    if (getWebSocketState() === WebSocket.CLOSED) {
      console.log('WebSocket not connected, attempting to reconnect...');
      await initializeWebSocketConnection();
    }
  } else {
    console.log('Session is invalid or expired');
  }
}, CHECK_INTERVAL);

// Function to handle clipboard messages
function handleClipboardMessage(data) {
  console.log('Handling clipboard message:', data);

  clipboardManager.setClipboardData(data);

  const newItem = {
    content: data.content.trim(),
    type: 'received',
    timestamp: Date.now(),
  };
  saveToHistory(newItem);

  // Create notification with copy action
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icon128.png'),
    title: 'New clipboard content received',
    message: data.content.substring(0, 50) + (data.content.length > 50 ? '...' : ''),
    priority: 1, // High priority to ensure delivery
    requireInteraction: true, // Keep notification until user interacts
    buttons: [{ title: 'Copy' }]
  }, (notificationId) => {
    if (chrome.runtime.lastError) {
      logError('Notification creation failed', chrome.runtime.lastError);
    } else {
      console.log('Notification created with ID:', notificationId);
    }
  });

  // Wake up the extension and establish WebSocket connection if needed
  if (getWebSocketState() !== WebSocket.OPEN) {
    initializeWebSocketConnection();
  }
}

function sendMessageToTab(tabId, message) {
  chrome.tabs.sendMessage(tabId, message, function (response) {
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
  // You might want to implement some error handling logic here
  // For example, you could try to reconnect or notify the user
}

function handleWebSocketClose(event) {
  console.log('WebSocket disconnected:', event.code, event.reason);
  // You might want to implement some reconnection logic here
  // For example, you could try to reconnect after a delay
}

// Function to send clipboard content to the server via WebSocket
async function sendClipboardContent(content) {
  try {
    if (await checkAndRefreshSession()) {
      if (!currentUser) {
        const { data: { user } } = await supabaseService.getUser();
        currentUser = user;
      }
      if (!currentUser) {
        console.error('User not authenticated');
        return { success: false, error: 'User not authenticated' };
      }

      const deviceId = await getOrCreateDeviceId();
      console.log('Sending clipboard content with deviceId:', deviceId); // Debug log

      if (!deviceId) {
        throw new Error('DeviceId not available');
      }

      if (getWebSocketState() !== WebSocket.OPEN) {
        console.log('WebSocket not open, attempting to reconnect...');
        await new Promise((resolve, reject) => {
          initializeWebSocketConnection();
          const timeout = setTimeout(() => {
            reject(new Error('WebSocket connection timeout'));
          }, 10000);
          const checkOpen = setInterval(() => {
            if (getWebSocketState() === WebSocket.OPEN) {
              clearTimeout(timeout);
              clearInterval(checkOpen);
              resolve();
            }
          }, 100);
        });
      }

      if (getWebSocketState() === WebSocket.OPEN) {
        const contentId = Date.now().toString();
        sendMessage({
          type: 'clipboard',
          content,
          contentId,
          deviceId
        });

        const newItem = {
          content: content.trim(),
          type: 'sent',
          timestamp: Date.now(),
          contentId,
          deviceId // Include deviceId in history
        };
        await saveToHistory(newItem);

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
  } else if (request.action === 'initializeExtension') {
    initializeSupabaseAndWebSocket().then(() => {
      sendResponse({ success: true });
    });
    return true; // Indicates that the response is sent asynchronously
  } else if (request.action === 'signup') {
    signup(request.email, request.password).then(sendResponse);
    return true;  // Indicates we will send a response asynchronously
  } else {
    console.error('Received: ', request, 'from: ', sender);
    return true;
  }
});

// Modify the initializeSupabaseAndWebSocket function
async function initializeSupabaseAndWebSocket() {
  try {
    const { supabaseSession } = await chrome.storage.local.get('supabaseSession');
    if (supabaseSession) {
      console.log('Stored session expires at:', new Date(epochToMs(supabaseSession.expires_at)).toISOString());
    }
    await supabaseService.setSession(supabaseSession);
    if (await checkAndRefreshSession()) {
      await initializeWebSocketConnection();
      // Try to register push notifications if we have a valid session
      try {
        await registerPushNotification();
      } catch (pushError) {
        console.error('Failed to register push notifications during initialization:', pushError);
        // Continue even if push registration fails
      }
    } else {
      console.log('No valid session found during initialization');
    }
  } catch (error) {
    logError('Error initializing Supabase and WebSocket', error);
  }
}

// Modify other functions that use supabase to ensure it's initialized
async function checkAuthStatus() {
  try {
    const { data, error } = await supabaseService.getSession();
    if (error) throw error;
    return { isAuthenticated: !!data.session };
  } catch (error) {
    console.error('Error checking auth status:', error);
    return { isAuthenticated: false, error: error.message };
  }
}

// Modify login function to send auth message after successful login
async function login(email, password) {
  try {
    await supabaseService.setSession(null);
    const { data, error } = await supabaseService.login(email, password);
    if (error) throw error;
    console.log('Login successful, user:', data.user);
    currentUser = data.user;
    currentSession = data.session;
    console.log('Session expires at:', new Date(epochToMs(currentSession.expires_at)).toISOString());
    chrome.storage.local.set({ supabaseSession: currentSession });

    // Initialize WebSocket first
    await initializeWebSocketConnection();

    // Then register push notifications
    try {
      await registerPushNotification();
    } catch (pushError) {
      console.error('Failed to register push notifications:', pushError);
      // Continue even if push registration fails
    }

    return { success: true, user: data.user };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: error.message };
  }
}

async function logout() {
  try {
    await supabaseService.setSession(null);
    closeWebSocket();
    chrome.storage.local.remove('supabaseSession');
    currentUser = null;
    currentSession = null;
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return { success: false, error: error.message };
  }
}

// Set up periodic WebSocket status check
setInterval(() => {
  if (getWebSocketState() === WebSocket.CLOSED) {
    console.log('WebSocket is not connected. Attempting to reconnect...');
    initializeWebSocketConnection();
  }
}, 30000); // Check every 30 seconds


// Add this function to handle sign-up
async function signup(email, password) {
  try {
    if (!supabaseService) {
      console.error('Supabase client not initialized');
      return { success: false, error: 'Supabase client not initialized' };
    }
    const { data, error } = await supabaseService.signup(email, password);
    if (error) throw error;

    if (data.user) {
      if (data.session) {
        // User already exists and password is correct, they're now logged in
        console.log('Existing user logged in:', data.user);
        currentSession = data.session;
        console.log('Session expires at:', new Date(epochToMs(currentSession.expires_at)).toISOString());
        chrome.storage.local.set({ supabaseSession: currentSession });
        initializeWebSocketConnection();
        return { success: true, user: data.user, message: 'Logged in successfully', isNewUser: false };
      } else {
        // New user, needs to confirm email
        console.log('Sign-up successful, user:', data.user);
        return { success: true, user: data.user, message: 'Sign-up successful! Please check your email for confirmation.', isNewUser: true };
      }
    } else {
      // This shouldn't happen, but just in case
      return { success: false, error: 'An unexpected error occurred' };
    }
  } catch (error) {
    console.error('Sign-up error:', error);
    return { success: false, error: error.message };
  }
}

// Add this function to log errors with more detail
function logError(message, error) {
  console.error(`${message}:`, error);
  console.error('Error stack:', error.stack);
}

// Add this function to handle periodic pings
function startPingInterval() {
  if (pingIntervalId) {
    clearInterval(pingIntervalId);
  }

  pingIntervalId = setInterval(() => {
    if (getWebSocketState() === WebSocket.OPEN) {
      sendMessage({ type: 'ping' });
    } else {
      console.log('WebSocket not open, attempting to reconnect...');
      initializeWebSocketConnection();
    }
  }, PING_INTERVAL);
}

// Update initializeWebSocketConnection to start ping interval
async function initializeWebSocketConnection() {
  try {
    const deviceId = await getOrCreateDeviceId();
    const deviceName = await getDeviceName();
    
    // Ensure we have a valid session before initializing WebSocket
    await checkAndRefreshSession();
    const { data: { session } } = await supabaseService.getSession();
    
    if (!session) {
      throw new Error('No valid session available');
    }

    console.log('Initializing WebSocket with deviceId:', deviceId);

    initWebSocket({
      wsUrl: process.env.REACT_APP_WS_URL,
      getAuthMessage: async () => {
        // Get fresh session right before sending auth message
        const { data: { session: currentSession } } = await supabaseService.getSession();
        if (!currentSession) {
          throw new Error('No valid session for auth message');
        }
        
        return {
          type: 'auth',
          token: currentSession.access_token,
          deviceId: deviceId,
          deviceName: deviceName,
        };
      },
      onOpen: () => {
        console.log('WebSocket connection opened');
        startPingInterval();
      },
      onMessage: (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'clipboard') {
            handleClipboardMessage(data);
          } else if (data.type === 'auth_success') {
            console.log('Authentication successful');
          } else if (data.type === 'auth_error') {
            console.error('Authentication failed:', data.error);
            // Try to refresh session and reconnect
            checkAndRefreshSession().then(() => {
              initializeWebSocketConnection();
            });
          } else if (data.type === 'pong') {
            console.log('Received pong from server');
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      },
      onError: handleWebSocketError,
      onClose: (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        if (pingIntervalId) {
          clearInterval(pingIntervalId);
          pingIntervalId = null;
        }
        handleWebSocketClose(event);
      }
    });
  } catch (error) {
    console.error('Error in initializeWebSocketConnection:', error);
  }
}

// Listen for alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    console.log('Alarm triggered, checking WebSocket connection...');
    if (getWebSocketState() !== WebSocket.OPEN) {
      console.log('WebSocket not open, reconnecting...');
      initializeWebSocketConnection();
    }
  }
});

// Function to convert VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = self.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Add push event listener
self.addEventListener('push', function (event) {
  console.log(`Push had this data/text: "${event.data.text()}"`);
});

self.addEventListener('push', function(event) {
  if (event.data) {
    console.log('received push', event)
    const data = event.data.json();
    
    // Store the clipboard data
    clipboardManager.setClipboardData(data);

    // Show notification
    self.registration.showNotification('Universal Clipboard', {
      body: data.content.substring(0, 50) + (data.content.length > 50 ? '...' : ''),
      icon: 'icon128.png',
      badge: 'icon128.png',
      data: data,
      actions: [{ action: 'copy', title: 'Copy' }]
    });
  }
});

// Add notification click handler
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  if (event.action === 'copy') {
    const data = event.notification.data;
    // Use the existing clipboard handling logic
    copyToClipboard(data.content);
  }
});

// Function to handle copying text to clipboard
async function copyToClipboard(text) {
  // Check if offscreen document exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });

  if (existingContexts.length === 0) {
    // Create an offscreen document if one doesn't exist
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['CLIPBOARD'],
      justification: 'Write text to clipboard'
    });
  }

  // Send the text to the offscreen document
  await chrome.runtime.sendMessage({
    type: 'copy-to-clipboard',
    content: text
  });

  /* On successful copy, if a webpage is in view, I want to invoke the toast logic in content.js */
  // Get the active tab to show toast notification
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id) {
      // Send message to content script to show toast
      await chrome.tabs.sendMessage(activeTab.id, {
        action: 'showToast',
        message: 'Copied to clipboard'
      });
    }
  } catch (error) {
    console.error('Error showing toast notification:', error);
  }
}
