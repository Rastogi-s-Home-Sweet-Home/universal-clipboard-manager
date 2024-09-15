import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { DevicePhoneMobileIcon, ComputerDesktopIcon, GlobeAltIcon } from '@heroicons/react/24/solid';

function DeviceList() {
  const [devices, setDevices] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const currentDeviceId = localStorage.getItem('deviceId');

  const fetchDevices = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .order('last_active', { ascending: false });

      if (error) throw error;
      setDevices(data);
    } catch (error) {
      console.error('Error fetching devices:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchDevices();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const subscription = supabase
      .channel('device_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, fetchDevices)
      .subscribe();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      subscription.unsubscribe();
    };
  }, [fetchDevices]);

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