importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

const { precacheAndRoute } = workbox.precaching;
const { registerRoute } = workbox.routing;
const { StaleWhileRevalidate, NetworkFirst } = workbox.strategies;

const CLIPBOARD_CHANNEL = 'universal-clipboard-channel';
const VERSION = '1.0.0';

// Cache static assets
precacheAndRoute(self.__WB_MANIFEST || []);

// Cache app shell (HTML, CSS, JS)
registerRoute(
  ({ request }) => 
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'document',
  new NetworkFirst({
    cacheName: 'app-shell',
    plugins: [
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [200],
      }),
    ],
  })
);

// Cache static assets (images, fonts)
registerRoute(
  ({ request }) => 
    request.destination === 'image' ||
    request.destination === 'font',
  new StaleWhileRevalidate({
    cacheName: 'static-assets',
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
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  console.log('Installing new service worker version:', VERSION);
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  console.log('Activating new service worker version:', VERSION);
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Clean up old caches
      caches.keys().then(keys => Promise.all(
        keys.map(key => {
          if (key.startsWith('workbox-') && !key.endsWith(VERSION)) {
            return caches.delete(key);
          }
        })
      ))
    ])
  );
});