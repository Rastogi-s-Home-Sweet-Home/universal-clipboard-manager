import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import WebSocketStatus from './WebSocketStatus';
import DeviceManagement from './DeviceManagement';
import ClipboardHistory from './ClipboardHistory';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { saveToHistory, updateDeviceStatus, openDatabase } from '../utils/dbUtils';
import { getDeviceName } from '../utils/deviceUtils';
import { fallbackCopyTextToClipboard } from '../utils/generalUtils';
import { useWebSocket } from '../context/WebSocketContext';
import ConnectedDevices from './ConnectedDevices';

function ClipboardSync() {
  const [clipboardContent, setClipboardContent] = useState('');
  const [status, setStatus] = useState('');
  const [showDeviceManagement, setShowDeviceManagement] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [receivedReceipts, setReceivedReceipts] = useState({});
  const { wsStatus, sendMessage, connect, disconnect } = useWebSocket();
  const [history, setHistory] = useState([]); // Add history state

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    disconnect();
    await updateDeviceStatus(false, getDeviceName());
    setStatus('Logged out. Device ID retained.');
  }, [disconnect]);

  // Add loadHistory function
  const loadHistory = useCallback(async () => {
    try {
      const db = await openDatabase();
      const transaction = db.transaction(['clipboardHistory'], 'readonly');
      const objectStore = transaction.objectStore('clipboardHistory');
      const request = objectStore.getAll();

      request.onsuccess = (event) => {
        const result = event.target.result;
        setHistory(result.sort((a, b) => b.timestamp - a.timestamp));
      };

      request.onerror = (event) => {
        console.error('Error loading history:', event.target.error);
      };
    } catch (error) {
      console.error('Error loading history:', error);
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (clipboardContent.trim()) {
      const contentId = Date.now().toString();
      const deviceId = localStorage.getItem('deviceId');
      const message = {
        type: 'clipboard',
        content: clipboardContent,
        contentId,
        deviceId
      };
      sendMessage(JSON.stringify(message));
      
      try {
        await saveToHistory(clipboardContent, 'sent', contentId, []);
        await loadHistory(); // Reload history after saving
        setStatus('Content sent');
      } catch (error) {
        console.error('Error saving to history:', error);
        setStatus('Error saving to history');
      }
    } else {
      setStatus('Nothing to send');
    }
  }, [clipboardContent, sendMessage, loadHistory]);

  const handleCopy = useCallback(async (content = clipboardContent) => {
    if (content) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(content);
          await saveToHistory(content, 'copied', Date.now().toString(), []);
          await loadHistory(); // Reload history after copying
          setStatus('Copied to clipboard');
        } else {
          fallbackCopyTextToClipboard(content);
          await saveToHistory(content, 'copied', Date.now().toString(), []);
          await loadHistory(); // Reload history after copying
          setStatus('Copied to clipboard (fallback method)');
        }
      } catch (err) {
        console.error('Failed to copy:', err);
        fallbackCopyTextToClipboard(content);
        await saveToHistory(content, 'copied', Date.now().toString(), []);
        await loadHistory(); // Reload history after copying
        setStatus('Copied to clipboard (fallback method)');
      }
    } else {
      setStatus('Nothing to copy');
    }
  }, [clipboardContent, loadHistory]);

  // Update the useEffect hook to handle WebSocket messages
  useEffect(() => {
    const handleWebSocketMessage = async (event) => {
      try {
        const data = event.detail;
        const currentDeviceId = localStorage.getItem('deviceId');
        
        if (data.type === 'clipboard' && data.deviceId !== currentDeviceId) {
          console.log('Received clipboard content:', data.content);
          
          setClipboardContent(data.content);
          setStatus('Received new content');
          
          try {
            await saveToHistory(data.content, 'received', data.contentId, []);
            await loadHistory(); // Reload history after receiving
            
            sendMessage(JSON.stringify({ 
              type: 'receipt', 
              contentId: data.contentId, 
              deviceId: currentDeviceId 
            }));
          } catch (error) {
            console.error('Error saving received content to history:', error);
          }
        } else if (data.type === 'receipt') {
          setReceivedReceipts((prev) => {
            const updatedReceipts = { ...prev };
            if (!updatedReceipts[data.contentId]) {
              updatedReceipts[data.contentId] = [];
            }
            if (!updatedReceipts[data.contentId].includes(data.deviceId)) {
              updatedReceipts[data.contentId].push(data.deviceId);
            }
            return updatedReceipts;
          });
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    };

    // Load initial history when component mounts
    loadHistory();

    // Set up WebSocket message listener
    window.addEventListener('websocket-message', handleWebSocketMessage);

    return () => {
      window.removeEventListener('websocket-message', handleWebSocketMessage);
    };
  }, [sendMessage, loadHistory]);

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
        <Button onClick={connect} variant="outline" className="w-full">Reconnect</Button>
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
          onClick={() => setShowDeviceManagement(!showDeviceManagement)}
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
        receivedReceipts={receivedReceipts}
        history={history} // Pass history to ClipboardHistory component
        setHistory={setHistory} // Pass setHistory to allow updates
      />
    </div>
  );
}

export default ClipboardSync;
