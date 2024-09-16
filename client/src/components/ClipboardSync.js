import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import WebSocketStatus from './WebSocketStatus';
import DeviceList from './DeviceList';
import DeviceManagement from './DeviceManagement';
import ClipboardHistory from './ClipboardHistory';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';


function openDatabase() {
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

async function saveToHistory(content, type) {
  const db = await openDatabase();
  const transaction = db.transaction(['clipboardHistory'], 'readwrite');
  const objectStore = transaction.objectStore('clipboardHistory');
  objectStore.add({ content, timestamp: Date.now(), type });
}

function getDeviceName() {
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

function fallbackCopyTextToClipboard(text, setStatus) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.select();
  try {
    document.execCommand('copy');
    setStatus('Copied to clipboard');
  } catch (err) {
    console.error('Fallback copy failed:', err);
    setStatus('Copy failed. Please copy manually.');
  }
  document.body.removeChild(textArea);
}

async function updateDeviceStatus(isOnline, supabase) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const deviceName = getDeviceName();
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

async function connectWebSocket(supabase, setStatus, setWsStatus, updateDeviceStatus, setClipboardContent) {
  console.log('Connecting WebSocket...');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.error('No active session');
    return null;
  }
  const deviceId = localStorage.getItem('deviceId');
  const wsUrl = process.env.NODE_ENV === 'development' ? process.env.REACT_APP_WS_URL : window.location.origin.replace(/^http/, 'ws');
  if (!wsUrl) {
    console.error('WebSocket URL is not defined in environment variables');
    return null;
  }
  const fullWsUrl = `${wsUrl}/ws?token=${session.access_token}&deviceId=${deviceId}`;
  console.log('Attempting to connect to WebSocket URL:', fullWsUrl);
  const newWs = new WebSocket(fullWsUrl);

  newWs.onopen = () => {
    console.log('WebSocket connected successfully');
    setStatus('Connected');
    setWsStatus('connected');
    updateDeviceStatus(true, supabase);
  };
  newWs.onclose = (event) => {
    console.log('WebSocket disconnected', event.code, event.reason);
    setStatus('Disconnected');
    setWsStatus('disconnected');
    updateDeviceStatus(false, supabase);
  };
  newWs.onerror = (error) => {
    console.error('WebSocket error:', error);
    setStatus('WebSocket error');
    setWsStatus('error');
  };
  newWs.onmessage = (event) => {
    console.log('Received message:', event.data);
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'clipboard') {
        setClipboardContent(data.content);
        setStatus('Received new content');
        saveToHistory(data.content, 'received');
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  };

  return newWs;
}

function ClipboardSync() {
  const [clipboardContent, setClipboardContent] = useState('');
  const [status, setStatus] = useState('');
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [showDeviceManagement, setShowDeviceManagement] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const wsRef = useRef(null);

  const handleSend = useCallback(() => {
    console.log('handleSend called');
    console.log('WebSocket readyState:', wsRef.current?.readyState);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ type: 'clipboard', content: clipboardContent });
      wsRef.current.send(message);
      console.log('Sent message:', message);
      setStatus('Sent to other devices');
      saveToHistory(clipboardContent, 'sent');
    } else {
      console.log('WebSocket is not connected. Current state:', wsRef.current?.readyState);
      setStatus('WebSocket is not connected. Reconnecting...');
      connectWebSocket(supabase, setStatus, setWsStatus, updateDeviceStatus, setClipboardContent).then(ws => {
        wsRef.current = ws;
        if (ws && ws.readyState === WebSocket.OPEN) {
          const message = JSON.stringify({ type: 'clipboard', content: clipboardContent });
          ws.send(message);
          console.log('Sent message after reconnection:', message);
          setStatus('Sent to other devices');
          saveToHistory(clipboardContent, 'sent');
        } else {
          setStatus('Failed to reconnect. Please try again.');
        }
      });
    }
  }, [clipboardContent, setStatus, setWsStatus, setClipboardContent, connectWebSocket]);

  const handleCopy = useCallback((content = clipboardContent) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(content)
        .then(() => {
          setStatus('Copied to clipboard');
          saveToHistory(content, 'copied');
        })
        .catch((err) => {
          console.error('Failed to copy to clipboard:', err);
          fallbackCopyTextToClipboard(content, setStatus);
        });
    } else {
      fallbackCopyTextToClipboard(content, setStatus);
    }
  }, [clipboardContent, setStatus]);

  const handleReconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    connectWebSocket(supabase, setStatus, setWsStatus, updateDeviceStatus, setClipboardContent).then(ws => {
      wsRef.current = ws;
    });
  }, [setStatus, setWsStatus, setClipboardContent]);

  useEffect(() => {
    let reconnectInterval;
    let pingInterval;
    const connect = async () => {
      const ws = await connectWebSocket(supabase, setStatus, setWsStatus, updateDeviceStatus, setClipboardContent);
      wsRef.current = ws;
      await updateDeviceStatus(true, supabase);
    };
    connect();

    const handleVisibilityChange = () => {
      if (!document.hidden && (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
        console.log('Page visible, reconnecting WebSocket');
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    reconnectInterval = setInterval(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.log('Attempting to reconnect WebSocket');
        connect();
      }
    }, 30000); // Try to reconnect every 30 seconds

    pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 20000); // Send a ping every 20 seconds

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      updateDeviceStatus(false, supabase);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(reconnectInterval);
      clearInterval(pingInterval);
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  return (
    <div className="space-y-6">
      <Textarea
        value={clipboardContent}
        onChange={(e) => setClipboardContent(e.target.value)}
        placeholder="Paste or type content here"
        className="min-h-[150px]"
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-3">
        <Button onClick={handleSend} className="w-full">Send</Button>
        <Button onClick={() => handleCopy()} variant="secondary" className="w-full">Copy</Button>
        <Button onClick={handleReconnect} variant="outline" className="w-full">Reconnect</Button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-3">
        <Button onClick={handleLogout} variant="destructive" className="w-full">Logout</Button>
        <Button onClick={() => setShowHistory(true)} variant="outline" className="w-full">History</Button>
        <Button onClick={() => setShowDeviceManagement(true)} variant="outline" className="w-full">Manage Devices</Button>
      </div>
      <WebSocketStatus status={wsStatus} />
      <div className="text-sm text-muted-foreground">{status}</div>
      <div className="bg-card text-card-foreground p-4 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-2">Connected Devices</h2>
        <DeviceList />
      </div>
      <ClipboardHistory
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        onCopy={(content) => {
          handleCopy(content);
          setClipboardContent(content);
        }}
      />
      <DeviceManagement
        isOpen={showDeviceManagement}
        onClose={() => setShowDeviceManagement(false)}
      />
    </div>
  );
}

export default ClipboardSync;