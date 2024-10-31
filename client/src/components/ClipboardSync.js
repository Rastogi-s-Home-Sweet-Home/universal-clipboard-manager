import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import DeviceManagement from './DeviceManagement';
import ClipboardHistory from './ClipboardHistory';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { saveToHistory, updateDeviceStatus, openDatabase } from '../utils/dbUtils';
import { getDeviceName } from '../utils/deviceUtils';
import { fallbackCopyTextToClipboard, urlBase64ToUint8Array } from '../utils/generalUtils';
import ConnectedDevices from './ConnectedDevices';
import { registerPushNotification } from '../utils/pushUtils';

const CLIPBOARD_CHANNEL = 'universal-clipboard-channel';

function ClipboardSync() {
  const [clipboardContent, setClipboardContent] = useState('');
  const [status, setStatus] = useState('');
  const [showDeviceManagement, setShowDeviceManagement] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    await updateDeviceStatus(false, getDeviceName());
    setStatus('Logged out. Device ID retained.');
  }, []);

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
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/clipboard`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            content: clipboardContent,
            contentId,
            deviceId
          })
        });

        if (!response.ok) {
          throw new Error('Failed to send clipboard content');
        }

        await saveToHistory(clipboardContent, 'sent', contentId, []);
        await loadHistory();
        setStatus('Content sent');
      } catch (error) {
        console.error('Error sending content:', error);
        setStatus('Error sending content');
      }
    } else {
      setStatus('Nothing to send');
    }
  }, [clipboardContent, loadHistory]);

  const handleCopy = useCallback(async (content = clipboardContent) => {
    if (content) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(content);
        } else {
          fallbackCopyTextToClipboard(content);
        }

        const contentId = Date.now().toString();
        const deviceId = localStorage.getItem('deviceId');
        const { data: { session } } = await supabase.auth.getSession();
        
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/clipboard`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            content,
            contentId,
            deviceId
          })
        });

        if (!response.ok) {
          throw new Error('Failed to send clipboard content');
        }

        await saveToHistory(content, 'copied', contentId, []);
        await loadHistory();
        setStatus('Copied to clipboard');
      } catch (error) {
        console.error('Error copying content:', error);
        setStatus('Error copying content');
      }
    } else {
      setStatus('Nothing to copy');
    }
  }, [clipboardContent, loadHistory]);

  useEffect(() => {
    const channel = new BroadcastChannel(CLIPBOARD_CHANNEL);
    
    channel.onmessage = async (event) => {
      const data = event.data;
      const currentDeviceId = localStorage.getItem('deviceId');
      
      switch(data.type) {
        case 'clipboard':
          if (data.deviceId !== currentDeviceId) {
            console.log('Received clipboard content:', data.content);
            
            setClipboardContent(data.content);
            
            // Try to copy only if document is focused
            if (document.hasFocus()) {
              try {
                await navigator.clipboard.writeText(data.content);
                setStatus('Content received and copied to clipboard');
              } catch (error) {
                console.error('Failed to auto-copy content:', error);
                setStatus('Content received (click Copy to copy)');
              }
            } else {
              // If document is not focused, just show status
              setStatus('Content received (click Copy to copy)');
            }
            
            try {
              await saveToHistory(data.content, 'received', data.contentId, []);
              await loadHistory();
            } catch (error) {
              console.error('Error saving received content to history:', error);
            }
          }
          break;
          
        case 'copy':
          try {
            await navigator.clipboard.writeText(data.content);
            setStatus('Content copied to clipboard');
            await saveToHistory(data.content, 'copied', Date.now().toString(), []);
            await loadHistory();
          } catch (error) {
            console.error('Failed to copy content:', error);
            setStatus('Failed to copy content');
          }
          break;
      }
    };

    const handleFocus = async () => {
      if (clipboardContent) {
        try {
          await navigator.clipboard.writeText(clipboardContent);
          setStatus('Content copied to clipboard');
        } catch (error) {
          console.error('Failed to copy on focus:', error);
        }
      }
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      channel.close();
      window.removeEventListener('focus', handleFocus);
    };
  }, [clipboardContent, loadHistory]);

  // Add notification click handler
  useEffect(() => {
    const handleNotificationClick = async (event) => {
      if (event.action === 'copy') {
        try {
          await navigator.clipboard.writeText(event.notification.data.content);
          setStatus('Content copied from notification');
          await saveToHistory(event.notification.data.content, 'copied', Date.now().toString(), []);
          await loadHistory();
        } catch (error) {
          console.error('Failed to copy from notification:', error);
          setStatus('Failed to copy from notification');
        }
      }
    };

    navigator.serviceWorker.addEventListener('notificationclick', handleNotificationClick);

    return () => {
      navigator.serviceWorker.removeEventListener('notificationclick', handleNotificationClick);
    };
  }, [loadHistory]);

  // Update the useEffect for push notification registration
  useEffect(() => {
    // Wait for service worker to be ready
    navigator.serviceWorker.ready
      .then(registration => {
        console.log('Service worker is ready, registering for push');
        return registerPushNotification();
      })
      .catch(error => {
        console.error('Error waiting for service worker:', error);
      });
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
        <Button onClick={handleLogout} variant="destructive" className="w-full">Logout</Button>
        <Button onClick={() => setShowHistory(true)} variant="outline" className="w-full">History</Button>
      </div>
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
        history={history}
        setHistory={setHistory}
      />
    </div>
  );
}

export default ClipboardSync;
