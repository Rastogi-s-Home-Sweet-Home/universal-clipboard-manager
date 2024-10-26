import { createClient } from '@supabase/supabase-js';
import { saveToHistory } from './utils/dbUtils';
import { initWebSocket, sendMessage, closeWebSocket, getWebSocketState } from './services/webSocketService';
import { getOrCreateDeviceId, getDeviceName } from './utils/deviceUtils';

let supabase;
let currentUser = null;
let currentSession = null;

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_KEY;

function epochToMs(epochSeconds) {
  return epochSeconds * 1000;
}

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

// Modify the initSupabase function
async function initSupabase(session) {
  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      }
    });
  }
  if (session) {
    await supabase.auth.setSession(session);
  }
  return supabase;
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
  try {
    if (!currentSession) {
      const { data: { session } } = await supabase.auth.getSession();
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
        const { data, error } = await supabase.auth.refreshSession();
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

// Initialize Supabase and WebSocket on extension load
chrome.runtime.onInstalled.addListener(async (details) => {
  await initializeSupabaseAndWebSocket();

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
  console.log('Performing periodic session check');
  if (await checkAndRefreshSession()) {
    console.log('Session is valid');
    if (getWebSocketState() === WebSocket.CLOSED) {
      console.log('WebSocket is closed, reinitializing...');
      initializeWebSocketConnection();
    }
  } else {
    console.log('Session is invalid or expired');
  }
}, 5 * 60 * 1000); // Check every 5 minutes

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

  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icon128.png'),
    title: 'New clipboard content received',
    message: data.content.substring(0, 50) + (data.content.length > 50 ? '...' : ''),
    priority: 1,
    buttons: [{ title: 'Copy' }]
  }, (notificationId) => {
    if (chrome.runtime.lastError) {
      logError('Notification creation failed', chrome.runtime.lastError);
    } else {
      console.log('Notification created with ID:', notificationId);
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
        const { data: { user } } = await supabase.auth.getUser();
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
  }
});

// Modify the initializeSupabaseAndWebSocket function
async function initializeSupabaseAndWebSocket() {
  try {
    const { supabaseSession } = await chrome.storage.local.get('supabaseSession');
    if (supabaseSession) {
      console.log('Stored session expires at:', new Date(epochToMs(supabaseSession.expires_at)).toISOString());
    }
    await initSupabase(supabaseSession);
    if (await checkAndRefreshSession()) {
      initializeWebSocketConnection();
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
    if (!supabase) {
      await initSupabase();
    }
    const { data, error } = await supabase.auth.getSession();
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
    if (!supabase) {
      await initSupabase();
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });
    if (error) throw error;
    console.log('Login successful, user:', data.user);
    currentUser = data.user;
    currentSession = data.session;
    console.log('Session expires at:', new Date(epochToMs(currentSession.expires_at)).toISOString());
    chrome.storage.local.set({ supabaseSession: currentSession });
    initializeWebSocketConnection();
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
  initializeSupabaseAndWebSocket().then(() => {
    checkNotificationPermission();
  });
});

// Set up periodic WebSocket status check
setInterval(() => {
  if (getWebSocketState() === WebSocket.CLOSED) {
    console.log('WebSocket is not connected. Attempting to reconnect...');
    initializeWebSocketConnection();
  }
}, 30000); // Check every 30 seconds

// Add this listener to handle notification button clicks
chrome.notifications.onButtonClicked.addListener(function (notificationId, buttonIndex) {
    if (buttonIndex === 0) {
        // Check if the Copy button was clicked
        var data = clipboardManager.getClipboardData(); // Get data using closure
        if (data) {
            // Send the copyToClipboard message to the active tab's content script
            chrome.tabs.query({
                active: true,
                currentWindow: true
            }, function (tabs) {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'copyToClipboard',
                        content: data.content
                    }, function (response) {
                        if (response && response.success) {
                            clipboardManager.clearClipboardData(); // Clear clipboard data after copying
                        } else {
                            console.error('Failed to copy content:', response.error);
                        }
                    });
                } else {
                    console.error('No active tab found to send message');
                }
            });
        } else {
            console.error('No clipboard data available to copy.');
        }
    }
});

// Add this function to handle sign-up
async function signup(email, password) {
  try {
    if (!supabase) {
      console.error('Supabase client not initialized');
      return { success: false, error: 'Supabase client not initialized' };
    }
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
    });
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

function checkAndRequestNotificationPermission() {
  chrome.permissions.contains({
    permissions: ['notifications']
  }, (result) => {
    if (result) {
      console.log('Notification permission already granted');
    } else {
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

// Call this function when the extension is installed or updated
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install' || details.reason === 'update') {
    checkAndRequestNotificationPermission();
  }
});

// Update the initializeWebSocketConnection function
async function initializeWebSocketConnection() {
  try {
    // First get the deviceId to ensure it exists
    const deviceId = await getOrCreateDeviceId();
    const deviceName = await getDeviceName();
    
    console.log('Initializing WebSocket with deviceId:', deviceId); // Debug log

    if (!deviceId) {
      throw new Error('Failed to get or create deviceId');
    }

    initWebSocket({
      wsUrl: process.env.REACT_APP_WS_URL,
      getAuthMessage: async () => {
        // Double check the deviceId is still valid
        const currentDeviceId = await getOrCreateDeviceId();
        console.log('Sending auth with deviceId:', currentDeviceId); // Debug log
        
        if (!currentDeviceId) {
          throw new Error('DeviceId not available for auth message');
        }

        return {
          type: 'auth',
          token: currentSession.access_token,
          deviceId: currentDeviceId,
          deviceName: deviceName,
        };
      },
      onOpen: () => {
        console.log('WebSocket connection opened');
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
          } else {
            console.log('Received other message:', data);
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      },
      onError: handleWebSocketError,
      onClose: handleWebSocketClose
    });
  } catch (error) {
    console.error('Error in initializeWebSocketConnection:', error);
    // Maybe implement retry logic here
  }
}
