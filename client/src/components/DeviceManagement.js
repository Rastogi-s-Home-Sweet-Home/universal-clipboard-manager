import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { useToast } from './ui/toast'; // Import the toast hook

function DeviceManagement({ isOpen, onClose, devices, onDevicesUpdated, isLoading }) {
  const { addToast } = useToast(); // Initialize the toast
  const [editingDevice, setEditingDevice] = useState(null);
  const [newName, setNewName] = useState('');
  const currentDeviceId = localStorage.getItem('deviceId'); // Get the current device ID

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase
        .from('devices')
        .delete()
        .eq('id', id);

      if (error) throw error;

      if (id === currentDeviceId) {
        await supabase.auth.signOut();
        window.location.reload();
      } else {
        onDevicesUpdated(); // Call this instead of fetchDevices
      }
    } catch (error) {
      console.error('Error deleting device:', error);
      addToast({ title: 'Error', description: 'Failed to delete device. Please try again.', variant: 'destructive', id: Date.now() });
    }
  };

  const handleEdit = (device) => {
    setEditingDevice(device);
    setNewName(device.name);
  };

  const handleSave = async () => {
    if (!editingDevice) return;

    try {
      const { error } = await supabase
        .from('devices')
        .update({ name: newName })
        .eq('id', editingDevice.id);

      if (error) throw error;
      setEditingDevice(null);
      onDevicesUpdated();
    } catch (error) {
      console.error('Error updating device:', error);
      addToast({ title: 'Error', description: 'Failed to update device. Please try again.', variant: 'destructive', id: Date.now() }); // Replace alert with toast
    }
  };

  const handleLogout = async (id) => {
    try {
      const { error } = await supabase
        .from('devices')
        .update({ is_online: false }) // Mark the device as offline
        .eq('id', id);

      if (error) throw error;

      if (id === currentDeviceId) {
        localStorage.removeItem('deviceId'); // Remove deviceId from localStorage
        await supabase.auth.signOut(); // Log out the user
        window.location.reload(); // Reload the page
      } else {
        onDevicesUpdated(); // Call this instead of fetchDevices
      }
    } catch (error) {
      console.error('Error logging out device:', error);
      addToast({ title: 'Error', description: 'Failed to log out device. Please try again.', variant: 'destructive', id: Date.now() }); // Replace alert with toast
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
          aria-label="Close"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>
        <h2 className="text-2xl font-bold mb-4">Device Management</h2>
        {isLoading ? (
          <div>Loading devices...</div>
        ) : devices.length === 0 ? (
          <p>No devices found.</p>
        ) : (
          <ul className="space-y-4">
            {devices.map(device => (
              <li key={device.id} className={`bg-background p-3 rounded-md shadow ${device.id === currentDeviceId ? 'border border-blue-500' : ''}`}>
                {editingDevice && editingDevice.id === device.id ? (
                  <div className="flex flex-col space-y-2">
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full"
                    />
                    <Button onClick={handleSave} variant="outline" className="w-full">Save</Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{device.name}</span>
                      {device.id === currentDeviceId && <span className="text-blue-500 font-bold">(Current Device)</span>}
                      <span className={`text-sm ${device.is_online ? 'text-green-500' : 'text-red-500'}`}>
                        {device.is_online ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Last active: {new Date(device.last_active).toLocaleString()}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => handleEdit(device)} variant="ghost" size="sm">Edit</Button>
                      <Button onClick={() => handleDelete(device.id)} variant="destructive" size="sm">Delete</Button>
                      <Button onClick={() => handleLogout(device.id)} variant="secondary" size="sm">Logout</Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default DeviceManagement;