import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import WebSocketStatus from './WebSocketStatus';
import DeviceManagement from './DeviceManagement';
import ClipboardHistory from './ClipboardHistory';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { saveToHistory, updateDeviceStatus } from '../utils/dbUtils';
import { getDeviceName } from '../utils/deviceUtils';
import { fallbackCopyTextToClipboard } from '../utils/generalUtils';
import { useWebSocket } from '../context/WebSocketContext'; // Import the context
import ConnectedDevices from './ConnectedDevices'; // Import the new component

function ClipboardSync() {
  const [clipboardContent, setClipboardContent] = useState('');
  const [status, setStatus] = useState('');
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [showDeviceManagement, setShowDeviceManagement] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [receivedReceipts, setReceivedReceipts] = useState({}); // Track received receipts
  const wsRef = useWebSocket(); // Use the context

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut(); // Log out the user
    if (wsRef.current) {
      wsRef.current.close(); // Close the WebSocket connection
    }
    await updateDeviceStatus(false, getDeviceName());
    setStatus('Logged out. Device ID retained.');
  }, [wsRef]); // Include wsRef in the dependency array

  const connectWebSocket = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('No active session');
      return null;
    }
    const deviceId = localStorage.getItem('deviceId');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname; // Use the current hostname
    const port = process.env.NODE_ENV === 'development' ? process.env.REACT_APP_WS_PORT : (window.location.port ?? ''); // Use 3000 in dev mode

    const wsUrl = `${protocol}//${host}:${port}/ws?token=${session.access_token}&deviceId=${deviceId}`;

    console.log('Attempting to connect to WebSocket URL:', wsUrl);
    const newWs = new WebSocket(wsUrl);

    newWs.onopen = () => {
      console.log('WebSocket connected successfully');
      setStatus('Connected');
      setWsStatus('connected');
      updateDeviceStatus(true, getDeviceName());
    };
    newWs.onclose = (event) => {
      console.log('WebSocket disconnected', event.code, event.reason);
      setStatus('Disconnected');
      setWsStatus('disconnected');
      updateDeviceStatus(false, getDeviceName());
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
        const currentDeviceId = localStorage.getItem('deviceId'); // Get the current device ID
        if (data.type === 'clipboard') {
          // Only process if the message is not from this device
          if (data.deviceId !== currentDeviceId) {
            setClipboardContent(data.content);
            setStatus('Received new content');
            saveToHistory(data.content, 'received', data.contentId, []); // Save the content with its ID

            // Send a receipt back to the sender
            const receiptMessage = JSON.stringify({ type: 'receipt', contentId: data.contentId, deviceId: currentDeviceId });
            wsRef.current.send(receiptMessage);
          } else {
            console.log('Ignoring message from own device:', data.content);
          }
        } else if (data.type === 'receipt') {
          console.log('Received receipt for content ID:', data.contentId);
          setReceivedReceipts((prev) => {
            const updatedReceipts = { ...prev };
            if (!updatedReceipts[data.contentId]) {
              updatedReceipts[data.contentId] = []; // Initialize if not present
            }
            updatedReceipts[data.contentId].push(data.deviceId); // Add the device ID to the receipt
            return updatedReceipts;
          });
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };

    return newWs;
  }, [wsRef]); // Include wsRef in the dependency array

  const handleSend = useCallback(() => {
    console.log('handleSend called');
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const contentId = Date.now(); // Unique ID for the content
      const currentDeviceId = localStorage.getItem('deviceId'); // Get the current device ID
      const message = JSON.stringify({ type: 'clipboard', content: clipboardContent, contentId, deviceId: currentDeviceId });
      wsRef.current.send(message);
      console.log('Sent message:', message);
      setStatus('Sent to other devices');
      saveToHistory(clipboardContent, 'sent', contentId, []); // Initialize receipts as empty

      // Initialize receipt tracking for this content
      setReceivedReceipts((prev) => ({ ...prev, [contentId]: [] }));
    } else {
      console.log('WebSocket is not connected. Current state:', wsRef.current?.readyState);
      setStatus('WebSocket is not connected. Reconnecting...');
      connectWebSocket().then(ws => {
        wsRef.current = ws;
        if (ws && ws.readyState === WebSocket.OPEN) {
          const contentId = Date.now(); // Unique ID for the content
          const currentDeviceId = localStorage.getItem('deviceId'); // Get the current device ID
          const message = JSON.stringify({ type: 'clipboard', content: clipboardContent, contentId, deviceId: currentDeviceId });
          ws.send(message);
          console.log('Sent message after reconnection:', message);
          setStatus('Sent to other devices');
          saveToHistory(clipboardContent, 'sent', contentId, []); // Initialize receipts as empty

          // Initialize receipt tracking for this content
          setReceivedReceipts((prev) => ({ ...prev, [contentId]: [] }));
        } else {
          setStatus('Failed to reconnect. Please try again.');
        }
      });
    }
  }, [clipboardContent, connectWebSocket, wsRef]);

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
    connectWebSocket().then(ws => {
      wsRef.current = ws;
    });
  }, [connectWebSocket, wsRef]);

  useEffect(() => {
    let reconnectInterval;
    let pingInterval;
    const connect = async () => {
      const ws = await connectWebSocket();
      wsRef.current = ws;
      await updateDeviceStatus(true, getDeviceName());
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
      updateDeviceStatus(false, getDeviceName());
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(reconnectInterval);
      clearInterval(pingInterval);
    };
  }, [connectWebSocket, wsRef]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const deviceName = getDeviceName(); // Get the device name
        await updateDeviceStatus(true, deviceName); // Update or create device entry
      }
    };
    checkAuth();
  }, []);

  return (
    <div className="container mx-auto px-4 pt-4">
      <p className="text-center text-gray-700 mb-6 text-lg font-medium">
        Copy or paste content below to sync it across all your connected devices instantly.
      </p>
      <Textarea
        value={clipboardContent}
        onChange={(e) => setClipboardContent(e.target.value)}
        placeholder="Paste or type content here"
        className="min-h-[150px] mb-4"
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 mb-4">
        <Button onClick={handleSend} className="w-full">Send</Button>
        <Button onClick={() => handleCopy()} variant="secondary" className="w-full">Copy</Button>
        <Button onClick={handleReconnect} variant="outline" className="w-full">Reconnect</Button>
        <Button onClick={handleLogout} variant="destructive" className="w-full">Logout</Button>
        <Button onClick={() => setShowHistory(true)} variant="outline" className="w-full">History</Button>
      </div>
      <WebSocketStatus status={wsStatus} />
      <div className="text-sm text-muted-foreground mb-4">{status}</div>
      <div className="mb-4">
        <ConnectedDevices />
      </div>
      <div className="mb-4">
        <Button 
          onClick={() => {
            console.log('Toggling Device Management');
            setShowDeviceManagement(!showDeviceManagement);
          }}
          variant="outline"
          className="w-full"
        >
          {showDeviceManagement ? 'Hide Device Management' : 'Show Device Management'}
        </Button>
      </div>
      {showDeviceManagement && (
        <div className="bg-card text-card-foreground p-4 rounded-lg shadow mb-4">
          <DeviceManagement isOpen={showDeviceManagement} onClose={() => setShowDeviceManagement(false)} />
        </div>
      )}
      <ClipboardHistory
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        onCopy={(content) => {
          handleCopy(content);
          setClipboardContent(content);
        }}
        receivedReceipts={receivedReceipts} // Pass the receipts as a prop
      />
    </div>
  );
}

export default ClipboardSync;