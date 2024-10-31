const CLIPBOARD_CHANNEL = 'universal-clipboard-channel';

// Add version number for tracking updates
const VERSION = '1.0.0';

// Listen for skip waiting message
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Add install event handler
self.addEventListener('install', (event) => {
  console.log('Installing new service worker version:', VERSION);
  // Force the waiting service worker to become the active service worker
  event.waitUntil(self.skipWaiting());
});

// Add activate event handler
self.addEventListener('activate', (event) => {
  console.log('Activating new service worker version:', VERSION);
  // Tell the active service worker to take immediate control of the page
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', async function(event) {
  if (event.data) {
    const data = event.data.json();
    
    // Use single channel for all communication
    const channel = new BroadcastChannel(CLIPBOARD_CHANNEL);
    
    try {
      // Send both the content and push message through same channel
      channel.postMessage({
        type: 'clipboard',
        content: data.content,
        contentId: data.contentId,
        deviceId: data.deviceId,
        timestamp: data.timestamp
      });

      // Show notification with "copied" message
      event.waitUntil(
        self.registration.showNotification('Universal Clipboard', {
          body: `Received: ${data.content.substring(0, 50)}${data.content.length > 50 ? '...' : ''}`,
          icon: '/logo192.png',
          badge: '/logo192.png',
          data: data,
          actions: [
            { action: 'copy', title: 'Copy' }
          ]
        })
      );
    } catch (error) {
      console.error('Failed to handle push:', error);
    } finally {
      channel.close();
    }
  }
});

// Keep notification click handler
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  if (event.action === 'copy') {
    const data = event.notification.data;
    const channel = new BroadcastChannel(CLIPBOARD_CHANNEL);
    channel.postMessage({
      type: 'copy',
      content: data.content
    });
    channel.close();
  }
}); 