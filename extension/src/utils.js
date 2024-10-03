export function epochToMs(epochSeconds) {
  return epochSeconds * 1000;
}

export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function getDeviceId() {
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

export function checkNotificationPermission() {
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

export function logError(message, error) {
  console.error(`${message}:`, error);
  console.error('Error stack:', error.stack);
}