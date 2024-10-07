import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import DeviceList from './DeviceList';
import DeviceManagement from './DeviceManagement';
import { Button } from './ui/button';
import throttle from 'lodash/throttle';

function ConnectedDevices() {
    const [devices, setDevices] = useState([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showDeviceManagement, setShowDeviceManagement] = useState(false);
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

    const throttledFetchDevicesRef = useRef(
        throttle(fetchDevices, 5000, { leading: true, trailing: false })
    );

    useEffect(() => {
        throttledFetchDevicesRef.current();

        const handleVisibilityChange = () => {
            if (!document.hidden) {
                throttledFetchDevicesRef.current();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        const subscription = supabase
            .channel('device_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, throttledFetchDevicesRef.current)
            .subscribe();

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            subscription.unsubscribe();
            throttledFetchDevicesRef.current.cancel();
        };
    }, [fetchDevices]);

    return (
        <div className="bg-card text-card-foreground p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-2">Connected Devices</h2>
            <DeviceList 
                devices={devices}
                currentDeviceId={currentDeviceId}
                isRefreshing={isRefreshing}
            />
            <div className="mt-4">
                <Button 
                    onClick={() => setShowDeviceManagement(!showDeviceManagement)}
                    variant="outline"
                    className="w-full"
                >
                    {showDeviceManagement ? 'Hide Device Management' : 'Show Device Management'}
                </Button>
            </div>
            {showDeviceManagement && (
                <DeviceManagement
                    isOpen={showDeviceManagement}
                    onClose={() => setShowDeviceManagement(false)}
                    devices={devices}
                    onDevicesUpdated={throttledFetchDevicesRef.current}
                    isLoading={isRefreshing}
                />
            )}
        </div>
    );
}

export default ConnectedDevices;