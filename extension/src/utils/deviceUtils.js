export function getOrCreateDeviceId() {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get('deviceId', (result) => {
        if (chrome.runtime.lastError) {
          console.error('Chrome storage error:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }

        if (result.deviceId && typeof result.deviceId === 'string' && result.deviceId.length > 0) {
          console.log('Retrieved existing deviceId:', result.deviceId);
          resolve(result.deviceId);
        } else {
          const newDeviceId = generateUUID();
          console.log('Generated new deviceId:', newDeviceId);
          chrome.storage.local.set({ deviceId: newDeviceId }, () => {
            if (chrome.runtime.lastError) {
              console.error('Error saving deviceId:', chrome.runtime.lastError);
              reject(chrome.runtime.lastError);
              return;
            }
            resolve(newDeviceId);
          });
        }
      });
    } catch (error) {
      console.error('Error in getOrCreateDeviceId:', error);
      reject(error);
    }
  });
}

export function getDeviceName() {
  return new Promise((resolve) => {
    chrome.runtime.getPlatformInfo((info) => {
      const name = `Chrome Extension (${info.os})`;
      console.log('Device name:', name);
      resolve(name);
    });
  });
}

function generateUUID() {
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
  
  if (!uuid || typeof uuid !== 'string' || uuid.length === 0) {
    throw new Error('Failed to generate valid UUID');
  }
  
  return uuid;
}
