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
import { useWebSocket } from '../context/WebSocketContext';
import ConnectedDevices from './ConnectedDevices';

function ClipboardSync() {
  const [clipboardContent, setClipboardContent] = useState('');
  const [status, setStatus] = useState('');
  const [showDeviceManagement, setShowDeviceManagement] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [receivedReceipts, setReceivedReceipts] = useState({});
  const { wsStatus, sendMessage, connect, disconnect } = useWebSocket();

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    disconnect();
    await updateDeviceStatus(false, getDeviceName());
    setStatus('Logged out. Device ID retained.');
  }, [disconnect]);

  const handleSend = useCallback(() => {
    if (clipboardContent.trim()) {
      const contentId = Date.now().toString();
      const message = {
        type: 'clipboard',
        content: clipboardContent,
        contentId,
        deviceId: localStorage.getItem('deviceId')
      };
      sendMessage(JSON.stringify(message));
      saveToHistory(clipboardContent, 'sent', contentId, []);
      setStatus('Content sent');
    } else {
      setStatus('Nothing to send');
    }
  }, [clipboardContent, sendMessage]);

  const handleCopy = useCallback((content = clipboardContent) => {
    if (content) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(content).then(() => {
          setStatus('Copied to clipboard');
        }).catch(err => {
          console.error('Failed to copy: ', err);
          fallbackCopyTextToClipboard(content);
          setStatus('Copied to clipboard (fallback method)');
        });
      } else {
        fallbackCopyTextToClipboard(content);
        setStatus('Copied to clipboard (fallback method)');
      }
    } else {
      setStatus('Nothing to copy');
    }
  }, [clipboardContent]);

  useEffect(() => {
    const handleWebSocketMessage = (event) => {
      try {
        let data;
        if (typeof event.data === 'string') {
          data = JSON.parse(event.data);
        } else if (typeof event.data === 'object') {
          data = event.data;
        } else {
          console.error('Received unknown data type:', typeof event.data);
          return;
        }

        const currentDeviceId = localStorage.getItem('deviceId');
        if (data.type === 'clipboard' && data.deviceId !== currentDeviceId) {
          setClipboardContent(data.content);
          setStatus('Received new content');
          saveToHistory(data.content, 'received', data.contentId, []);
          sendMessage(JSON.stringify({ type: 'receipt', contentId: data.contentId, deviceId: currentDeviceId }));
        } else if (data.type === 'receipt') {
          setReceivedReceipts((prev) => {
            const updatedReceipts = { ...prev };
            if (!updatedReceipts[data.contentId]) {
              updatedReceipts[data.contentId] = [];
            }
            updatedReceipts[data.contentId].push(data.deviceId);
            return updatedReceipts;
          });
        }
      } catch (error) {
        console.error('Error handling message:', error);
      }
    };

    // Set up the message listener
    window.addEventListener('message', handleWebSocketMessage);

    // Clean up the listener when the component unmounts
    return () => {
      window.removeEventListener('message', handleWebSocketMessage);
    };
  }, [sendMessage]);

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
        receivedReceipts={receivedReceipts}
      />
    </div>
  );
}

export default ClipboardSync;