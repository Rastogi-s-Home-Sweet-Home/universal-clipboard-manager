export function getDeviceName() {
  const ua = navigator.userAgent;
  let deviceName = 'Unknown Device';

  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    deviceName = 'Tablet';
  } else if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
    deviceName = 'Mobile';
  } else {
    deviceName = 'Desktop';
  }

  if (/(iPhone|iPod|iPad)/i.test(ua)) {
    deviceName += ' - iOS';
  } else if (/Android/.test(ua)) {
    deviceName += ' - Android';
  } else if (/Mac OS X/.test(ua)) {
    deviceName += ' - macOS';
  } else if (/Windows/.test(ua)) {
    deviceName += ' - Windows';
  } else if (/Linux/.test(ua)) {
    deviceName += ' - Linux';
  }

  if (/Chrome/.test(ua)) {
    deviceName += ' (Chrome)';
  } else if (/Firefox/.test(ua)) {
    deviceName += ' (Firefox)';
  } else if (/Safari/.test(ua)) {
    deviceName += ' (Safari)';
  } else if (/Edge/.test(ua)) {
    deviceName += ' (Edge)';
  } else if (/Opera|OPR/.test(ua)) {
    deviceName += ' (Opera)';
  }

  return deviceName;
}