import { useState, useCallback, useEffect } from 'react';
import { saveToHistory } from '../utils/dbUtils';

export function useClipboardSync(isExtension = false) {
  const [clipboardContent, setClipboardContent] = useState('');
  const [status, setStatus] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [history, setHistory] = useState([]); // Add history state

  const handleSend = useCallback(() => {
    if (clipboardContent.trim()) {
      if (isExtension) {
        chrome.runtime.sendMessage({ action: 'sendClipboardContent', content: clipboardContent }, function (response) {
          if (chrome.runtime.lastError) {
            setStatus('Error: ' + chrome.runtime.lastError.message);
          } else if (response.success) {
            setStatus('Content sent successfully');
            // Save to history
            const newItem = {
              content: clipboardContent.trim(),
              type: 'sent',
              timestamp: Date.now(),
            };
            saveToHistory(newItem);
            setHistory((prev) => [...prev, newItem]); // Update history state
            setClipboardContent(''); // Clear the input after successful send
          } else {
            setStatus('Error: ' + (response.error || 'Unknown error'));
          }
        });
      } else {
        // Client-side send logic
        setStatus('Content sent (client-side)');
      }
    } else {
      setStatus('Please enter some content to send');
    }
  }, [clipboardContent, isExtension, setHistory]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(clipboardContent).then(() => {
      setStatus('Copied to clipboard');
      // Save copied content to history
      const newItem = {
        content: clipboardContent,
        type: 'copied',
        timestamp: Date.now(),
      };
      saveToHistory(newItem);
      setHistory((prev) => [...prev, newItem]); // Update history state
    }).catch(err => {
      setStatus('Failed to copy: ' + err);
    });
  }, [clipboardContent]);

  const handleLogout = useCallback(() => {
    if (isExtension) {
      chrome.runtime.sendMessage({action: 'logout'}, function(response) {
        if (chrome.runtime.lastError) {
          setStatus('Logout error: ' + chrome.runtime.lastError.message);
        } else if (response.success) {
          setStatus('Logged out successfully');
          setIsAuthenticated(false);
        } else {
          setStatus('Logout failed: ' + (response.error || 'Unknown error'));
        }
      });
    } else {
      // Client-side logout logic
      // You'll need to implement this based on your client-side setup
      setStatus('Logged out (client-side)');
      setIsAuthenticated(false);
    }
  }, [isExtension]);

  const handleLogin = useCallback((email, password) => {
    if (isExtension) {
      chrome.runtime.sendMessage({action: 'login', email, password}, function(response) {
        if (chrome.runtime.lastError) {
          setStatus('Login error: ' + chrome.runtime.lastError.message);
        } else if (response.success) {
          setStatus('Logged in successfully');
          setIsAuthenticated(true);
        } else {
          setStatus('Login failed: ' + (response.error || 'Unknown error'));
        }
      });
    } else {
      // Client-side login logic
      // You'll need to implement this based on your client-side setup
      setStatus('Logged in (client-side)');
      setIsAuthenticated(true);
    }
  }, [isExtension]);

  const handleSignUp = useCallback((email, password) => {
    if (isExtension) {
      chrome.runtime.sendMessage({action: 'signup', email, password}, function(response) {
        if (chrome.runtime.lastError) {
          setStatus('Sign-up error: ' + chrome.runtime.lastError.message);
        } else if (response.success) {
          setStatus(response.message);
          if (!response.isNewUser) {
            setIsAuthenticated(true);
          }
        } else {
          setStatus('Sign-up failed: ' + (response.error || 'Unknown error'));
        }
      });
    } else {
      // Client-side sign-up logic
      // You'll need to implement this based on your client-side setup
      setStatus('Signed up (client-side)');
    }
  }, [isExtension, setIsAuthenticated]);

  useEffect(() => {
    if (isExtension) {
      const checkAuthStatus = () => {
        chrome.runtime.sendMessage({action: 'checkAuth'}, function(response) {
          if (chrome.runtime.lastError) {
            console.error('Error checking auth:', chrome.runtime.lastError);
            setStatus('Error checking auth: ' + chrome.runtime.lastError.message);
          } else if (response && response.isAuthenticated) {
            setIsAuthenticated(true);
            setStatus('Authenticated');
          } else {
            setIsAuthenticated(false);
            setStatus('Not authenticated');
          }
        });
      };

      // Check auth status immediately
      checkAuthStatus();

      // Set up an interval to check auth status periodically
      const intervalId = setInterval(checkAuthStatus, 60000); // Check every minute

      return () => clearInterval(intervalId);
    }
  }, [isExtension]);

  return {
    clipboardContent,
    setClipboardContent,
    status,
    isAuthenticated,
    handleSend,
    handleCopy,
    handleLogout,
    handleLogin,
    handleSignUp,
    history, // Return history
    setHistory, // Return setHistory
  };
}