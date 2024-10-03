import { initSupabase, checkAndRefreshSession } from './services/supabaseService';
import { initWebSocket } from './services/webSocketService';
import { login, logout, signup, checkAuthStatus } from './services/authService';
import { sendClipboardContent } from './services/clipboardService';
import { checkNotificationPermission, logError } from './utils';

// Initialize Supabase and WebSocket on extension load
chrome.runtime.onInstalled.addListener(async (details) => {
  await initializeSupabaseAndWebSocket();
  if (details.reason === 'install') {
    checkNotificationPermission();
  }
});

// Periodically check and refresh the session
setInterval(async () => {
  console.log('Performing periodic session check');
  if (await checkAndRefreshSession()) {
    console.log('Session is valid');
    initWebSocket();
  } else {
    console.log('Session is invalid or expired');
  }
}, 5 * 60 * 1000); // Check every 5 minutes

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkAuth') {
    checkAuthStatus().then(sendResponse);
  } else if (request.action === 'login') {
    login(request.email, request.password).then(sendResponse);
  } else if (request.action === 'logout') {
    logout().then(sendResponse);
  } else if (request.action === 'sendClipboardContent') {
    sendClipboardContent(request.content).then(sendResponse);
  } else if (request.action === 'initializeExtension') {
    initializeSupabaseAndWebSocket().then(() => {
      sendResponse({ success: true });
    });
  } else if (request.action === 'signup') {
    signup(request.email, request.password).then(sendResponse);
  }
  return true; // Indicates an asynchronous response
});

async function initializeSupabaseAndWebSocket() {
  try {
    await initSupabase();
    if (await checkAndRefreshSession()) {
      initWebSocket();
    } else {
      console.log('No valid session found during initialization');
    }
  } catch (error) {
    logError('Error initializing Supabase and WebSocket', error);
  }
}

// Initialize WebSocket connection when the service worker starts
chrome.runtime.onStartup.addListener(() => {
  initializeSupabaseAndWebSocket().then(() => {
    checkNotificationPermission();
  });
});

// Set up periodic WebSocket status check
setInterval(() => {
  initWebSocket();
}, 30000); // Check every 30 seconds