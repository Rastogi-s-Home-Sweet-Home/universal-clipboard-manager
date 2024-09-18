import { supabase } from '../supabaseClient';

export async function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ClipboardManagerDB', 1);
    request.onerror = (event) => reject('Error opening database');
    request.onsuccess = (event) => resolve(event.target.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      db.createObjectStore('clipboardHistory', { keyPath: 'id', autoIncrement: true });
    };
  });
}

export async function saveToHistory(content, type) {
  const db = await openDatabase();
  const transaction = db.transaction(['clipboardHistory'], 'readwrite');
  const objectStore = transaction.objectStore('clipboardHistory');
  objectStore.add({ content, timestamp: Date.now(), type });
}

export async function updateDeviceStatus(isOnline, deviceName) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const currentDeviceId = localStorage.getItem('deviceId');

  if (!currentDeviceId) {
    const { data, error } = await supabase
      .from('devices')
      .insert({ user_id: session.user.id, name: deviceName, is_online: isOnline })
      .select();
    if (error) {
      console.error('Error creating device:', error);
      return;
    }
    localStorage.setItem('deviceId', data[0].id);
  } else {
    await supabase
      .from('devices')
      .update({ name: deviceName, is_online: isOnline, last_active: new Date().toISOString() })
      .eq('id', currentDeviceId);
  }
}