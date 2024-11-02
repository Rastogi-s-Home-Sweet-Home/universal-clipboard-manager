import { createClient } from '@supabase/supabase-js';
import { getOrCreateDeviceId, getDeviceName } from './utils/deviceUtils';
import { saveToHistory } from './utils/dbUtils';
import supabaseService from './services/supabaseService';
import { epochToMs } from './utils/timeUtils';

let currentUser = null;
let currentSession = null;

// Closure to manage clipboard data
const clipboardManager = (() => {
  let clipboardData = null;
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

      const subscription = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.REACT_APP_VAPID_PUBLIC_KEY)
      });

      const subscribeUrl = `${process.env.REACT_APP_API_URL}subscribe`;
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

// Single onInstalled listener
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed/updated:', details.reason);
  await initializeSupabase();
});

// Single onStartup handler
chrome.runtime.onStartup.addListener(async () => {
  console.log('Extension starting up...');
  await initializeSupabase();
});

// Single interval for session checks
const CHECK_INTERVAL = 30000; // 30 seconds
setInterval(async () => {
  await checkAndRefreshSession();
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
    priority: 1,
    requireInteraction: true,
    buttons: [{ title: 'Copy' }]
  });
}

// Function to send clipboard content
async function sendClipboardContent(content) {
  try {
    if (await checkAndRefreshSession()) {
      const deviceId = await getOrCreateDeviceId();
      const contentId = Date.now().toString();

      const { data: { session } } = await supabaseService.getSession();
      const response = await fetch(`${process.env.REACT_APP_API_URL}api/clipboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          content,
          contentId,
          deviceId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send clipboard content');
      }

      await saveToHistory({
        content: content.trim(),
        type: 'sent',
        timestamp: Date.now(),
        contentId,
        deviceId
      });

      return { success: true };
    } else {
      throw new Error('User not authenticated');
    }
  } catch (error) {
    console.error('Error sending clipboard content:', error);
    return { success: false, error: error.message };
  }
}

// Initialize Supabase
async function initializeSupabase() {
  try {
    const { supabaseSession } = await chrome.storage.local.get('supabaseSession');
    if (supabaseSession) {
      console.log('Stored session expires at:', new Date(epochToMs(supabaseSession.expires_at)).toISOString());
    }
    await supabaseService.setSession(supabaseSession);
    if (await checkAndRefreshSession()) {
      try {
        await registerPushNotification();
      } catch (pushError) {
        console.error('Failed to register push notifications during initialization:', pushError);
      }
    } else {
      console.log('No valid session found during initialization');
    }
  } catch (error) {
    logError('Error initializing Supabase', error);
  }
}

// Message handlers
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkAuth') {
    checkAuthStatus().then(sendResponse);
    return true;
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
    initializeSupabase().then(() => {
      sendResponse({ success: true });
    });
    return true;
  } else if (request.action === 'signup') {
    signup(request.email, request.password).then(sendResponse);
    return true;
  }
});

// Push event handlers
self.addEventListener('push', function (event) {
  if (event.data) {
    const data = event.data.json();
    handleClipboardMessage(data);
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  if (event.action === 'copy') {
    const data = event.notification.data;
    copyToClipboard(data.content);
  }
});

// Function to handle copying text to clipboard
async function copyToClipboard(text) {
  try {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });

    if (existingContexts.length === 0) {
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['CLIPBOARD'],
        justification: 'Write text to clipboard'
      });
    }

    await chrome.runtime.sendMessage({
      type: 'copy-to-clipboard',
      content: text
    });

    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.id) {
        await chrome.tabs.sendMessage(activeTab.id, {
          action: 'showToast',
          message: 'Copied to clipboard'
        });
      }
    } catch (error) {
      console.error('Error showing toast notification:', error);
    }
  } catch (error) {
    console.error('Error in copyToClipboard:', error);
    throw error;
  }
}

// Helper functions
function logError(message, error) {
  console.error(`${message}:`, error);
  console.error('Error stack:', error.stack);
}

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

// Add authentication methods
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

    // Register for push notifications
    try {
      await registerPushNotification();
    } catch (pushError) {
      console.error('Failed to register push notifications:', pushError);
    }

    return { success: true, user: data.user };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: error.message };
  }
}

async function signup(email, password) {
  try {
    const { data, error } = await supabaseService.signup(email, password);
    if (error) throw error;

    if (data.user) {
      if (data.session) {
        // User already exists and password is correct, they're now logged in
        console.log('Existing user logged in:', data.user);
        currentSession = data.session;
        console.log('Session expires at:', new Date(epochToMs(currentSession.expires_at)).toISOString());
        chrome.storage.local.set({ supabaseSession: currentSession });

        // Register for push notifications
        try {
          await registerPushNotification();
        } catch (pushError) {
          console.error('Failed to register push notifications:', pushError);
        }

        return {
          success: true,
          user: data.user,
          message: 'Logged in successfully',
          isNewUser: false
        };
      } else {
        // New user, needs to confirm email
        console.log('Sign-up successful, user:', data.user);
        return {
          success: true,
          user: data.user,
          message: 'Sign-up successful! Please check your email for confirmation.',
          isNewUser: true
        };
      }
    } else {
      return { success: false, error: 'An unexpected error occurred' };
    }
  } catch (error) {
    console.error('Sign-up error:', error);
    return { success: false, error: error.message };
  }
}

async function logout() {
  try {
    await supabaseService.setSession(null);
    chrome.storage.local.remove('supabaseSession');
    currentUser = null;
    currentSession = null;
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return { success: false, error: error.message };
  }
}

async function checkAuthStatus() {
  try {
    // First try to get current session
    const { data, error } = await supabaseService.getSession();

    if (error) throw error;

    // If we have a session, check if it needs refresh
    if (data.session) {
      const expiresAt = new Date(epochToMs(data.session.expires_at));
      const now = new Date();

      if (expiresAt < now) {
        console.log('Session expired, attempting refresh...');
        // Try to refresh the session
        const { data: refreshData, error: refreshError } = await supabaseService.refreshSession();
        if (refreshError) throw refreshError;

        // If refresh successful, update storage and return new state
        if (refreshData.session) {
          chrome.storage.local.set({ supabaseSession: refreshData.session });
          return { isAuthenticated: true };
        }
      } else {
        return { isAuthenticated: true };
      }
    }

    return { isAuthenticated: false };
  } catch (error) {
    console.error('Error checking auth status:', error);
    return { isAuthenticated: false, error: error.message };
  }
}

