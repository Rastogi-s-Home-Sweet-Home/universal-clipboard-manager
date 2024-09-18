import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import DeviceList from './DeviceList';

function ConnectedDevices() {
    const [devices, setDevices] = useState([]);
    const currentDeviceId = localStorage.getItem('deviceId');

    const fetchDevices = async () => {
        const { data, error } = await supabase
            .from('devices')
            .select('*')
            .order('last_active', { ascending: false });

        if (error) {
            console.error('Error fetching devices:', error);
            return;
        }
        setDevices(data);
    };

    useEffect(() => {
        fetchDevices();
    }, []);

    return (
        <div className="bg-card text-card-foreground p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-2">Connected Devices</h2>
            <DeviceList devices={devices} currentDeviceId={currentDeviceId} />
        </div>
    );
}

export default ConnectedDevices;