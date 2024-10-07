import React from 'react';
import { DevicePhoneMobileIcon, ComputerDesktopIcon, GlobeAltIcon } from '@heroicons/react/24/solid';

function DeviceList({ devices, currentDeviceId, isRefreshing }) {
  const getDeviceIcon = (deviceName) => {
    if (deviceName.includes('Mobile') || deviceName.includes('iOS') || deviceName.includes('Tablet')) {
      return <DevicePhoneMobileIcon className="h-5 w-5" />;
    } else if (deviceName.includes('Desktop') || deviceName.includes('macOS') || deviceName.includes('Windows')) {
      return <ComputerDesktopIcon className="h-5 w-5" />;
    } else {
      return <GlobeAltIcon className="h-5 w-5" />;
    }
  };

  return (
    <div>
      {isRefreshing && <div className="text-sm text-blue-500 mb-2">Refreshing...</div>}
      <ul className="space-y-2">
        {devices.map(device => (
          <li key={device.id} className="flex justify-between items-center">
            <span className="flex items-center space-x-2">
              {getDeviceIcon(device.name)}
              <span className={device.id === currentDeviceId ? 'font-bold' : ''}>
                {device.name}
                {device.id === currentDeviceId && ' (This device)'}
              </span>
            </span>
            <span className={`h-3 w-3 rounded-full ${device.is_online || device.id === currentDeviceId ? 'bg-green-500' : 'bg-red-500'}`} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default DeviceList;