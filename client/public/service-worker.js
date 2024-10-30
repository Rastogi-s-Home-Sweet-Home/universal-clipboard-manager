self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    
    event.waitUntil(
      self.registration.showNotification('Universal Clipboard', {
        body: data.content.substring(0, 50) + (data.content.length > 50 ? '...' : ''),
        icon: '/logo192.png',
        badge: '/logo192.png',
        data: data,
        actions: [
          { action: 'copy', title: 'Copy' }
        ]
      })
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  if (event.action === 'copy') {
    const data = event.notification.data;
    // Send message to app to copy content
    const channel = new BroadcastChannel('clipboard-channel');
    channel.postMessage({
      type: 'copy',
      content: data.content
    });
  }
}); 