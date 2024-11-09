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
  if (event.data) {
    const data = event.data.json();
    const channel = new BroadcastChannel(CLIPBOARD_CHANNEL);
    
    try {
      channel.postMessage({
        type: 'clipboard',
        content: data.content,
        contentId: data.contentId,
        deviceId: data.deviceId,
        timestamp: data.timestamp
      });

      await self.registration.showNotification('Universal Clipboard', {
        body: `Received: ${data.content.substring(0, 50)}${data.content.length > 50 ? '...' : ''}`,
        icon: '/android-chrome-192x192.png',
        badge: '/android-chrome-192x192.png',
        data: data,
        actions: [{ action: 'copy', title: 'Copy' }],
        requireInteraction: true
      });
    } catch (error) {
      console.error('Failed to handle push:', error);
    } finally {
      channel.close();
    }
  }
});

// Handle notification clicks
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

// Handle service worker lifecycle
self.addEventListener('install', (event) => {
  console.log('Installing new service worker version:', VERSION);
  // Skip waiting automatically to prevent stale cache issues
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Activating new service worker version:', VERSION);
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => cacheName.startsWith('universal-clipboard-'))
            .filter(cacheName => cacheName !== CACHE_NAME)
            .map(cacheName => caches.delete(cacheName))
        );
      }),
      // Take control of all clients immediately
      self.clients.claim()
    ])
  );
});

// Handle immediate activation requests
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});