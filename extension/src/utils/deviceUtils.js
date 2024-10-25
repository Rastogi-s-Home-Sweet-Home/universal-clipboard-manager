export function getOrCreateDeviceId() {
  return new Promise((resolve) => {
    chrome.storage.local.get('deviceId', (result) => {
      if (result.deviceId) {
        resolve(result.deviceId);
      } else {
        const newDeviceId = generateUUID();
        chrome.storage.local.set({ deviceId: newDeviceId }, () => {
          resolve(newDeviceId);
        });
      }
    });
  });
}

export function getDeviceName() {
  return new Promise((resolve) => {
    chrome.runtime.getPlatformInfo((info) => {
      resolve(`Chrome Extension (${info.os})`);
    });
  });
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
