importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

const { precacheAndRoute } = workbox.precaching;
const { registerRoute } = workbox.routing;
const { StaleWhileRevalidate, NetworkFirst } = workbox.strategies;

const CLIPBOARD_CHANNEL = 'universal-clipboard-channel';
const VERSION = '1.0.1';
const CACHE_NAME = `universal-clipboard-v${VERSION}`;

// Precache and route all build-time assets
precacheAndRoute(self.__WB_MANIFEST || []);

// Handle JavaScript and CSS files with NetworkFirst strategy
registerRoute(
  ({ request }) => 
    request.destination === 'script' ||
    request.destination === 'style',
  new NetworkFirst({
    cacheName: 'assets-cache',
    plugins: [
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200]
      }),
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
      })
    ]
  })
);

// Handle navigation requests (HTML)
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'pages-cache',
    plugins: [
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200]
      })
    ]
  })
);

// Handle push notifications
self.addEventListener('push', async function(event) {
  console.log('Push notification received:', event.data ? event.data.text() : 'no payload');
  
  if (event.data) {
    try {
      const data = event.data.json();
      console.log('Parsed push data:', data); // Debug log
      
      // Validate required fields
      if (!data.content) {
        throw new Error('Push notification missing required content field');
      }

      // Use a fallback for deviceId if it's null
      const deviceId = data.deviceId || 'unknown-device';
      
      const channel = new BroadcastChannel(CLIPBOARD_CHANNEL);
      
      console.log('Broadcasting to channel:', CLIPBOARD_CHANNEL, {
        type: 'clipboard',
        content: data.content,
        contentId: data.contentId || `fallback-${Date.now()}`,
        deviceId: deviceId,
        timestamp: data.timestamp || Date.now()
      });

      channel.postMessage({
        type: 'clipboard',
        content: data.content,
        contentId: data.contentId || `fallback-${Date.now()}`,
        deviceId: deviceId,
        timestamp: data.timestamp || Date.now()
      });

      await self.registration.showNotification('Universal Clipboard', {
        body: `Received from ${deviceId}: ${data.content.substring(0, 50)}${data.content.length > 50 ? '...' : ''}`,
        icon: '/android-chrome-192x192.png',
        badge: '/android-chrome-192x192.png',
        data: {
          ...data,
          deviceId: deviceId // Ensure deviceId is passed through
        },
        actions: [{ action: 'copy', title: 'Copy' }],
        requireInteraction: true
      });
    } catch (error) {
      console.error('Failed to handle push:', error, error.stack, {
        rawData: event.data ? event.data.text() : 'no data',
      }); // Enhanced error logging
    } finally {
      channel?.close();
    }
  }
});

// Handle notification clicks with enhanced logging
self.addEventListener('notificationclick', function(event) {
  console.log('Notification clicked:', event.action); // Debug log
  event.notification.close();
  
  if (event.action === 'copy') {
    const data = event.notification.data;
    console.log('Copying content:', data); // Debug log
    const channel = new BroadcastChannel(CLIPBOARD_CHANNEL);
    channel.postMessage({
      type: 'copy',
      content: data.content
    });
    channel.close();
  }
});

// Handle service worker lifecycle
self.addEventListener('install', (event) => {
  console.log('Installing new service worker version:', VERSION);
  // Skip waiting automatically to prevent stale cache issues
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Activating new service worker version:', VERSION);
  console.log('Clients:', self.clients); // Debug log
  event.waitUntil(
    Promise.all([
      caches.keys().then(cacheNames => {
        console.log('Existing caches:', cacheNames); // Debug log
        return Promise.all(
          cacheNames
            .filter(cacheName => cacheName.startsWith('universal-clipboard-'))
            .filter(cacheName => cacheName !== CACHE_NAME)
            .map(cacheName => {
              console.log('Deleting cache:', cacheName); // Debug log
              return caches.delete(cacheName);
            })
        );
      }),
      self.clients.claim().then(() => {
        console.log('Claimed all clients'); // Debug log
      })
    ])
  );
});

// Handle immediate activation requests
self.addEventListener('message', (event) => {
  console.log('Service Worker received message:', event.data); // Debug log
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});